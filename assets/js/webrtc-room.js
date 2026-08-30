/**
 * Master Audio Collab - Motor WebRTC e Sinalização
 */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof macRoomData === 'undefined' || typeof io === 'undefined') {
        console.error('Master Audio Collab: Dados de inicialização ou Socket.io ausentes.');
        return;
    }

    // 1. Tratamento de Cold Start (Render)
    // Aumentamos o timeout nativo para dar tempo da máquina virtual despertar
    const socket = io(macRoomData.signalingServer, {
        reconnectionDelayMax: 10000,
        timeout: 45000 
    });
    
    const roomId = macRoomData.roomId;
    const peers = {}; 
    let localStream = null;
    let isServerAwake = false;
    
    const participantsContainer = document.getElementById('mac-participants-container');
    const joinButton = document.getElementById('mac-btn-join');
    const localStatus = document.querySelector('.local-participant .mac-status-indicator');

    // Monitor de latência de inicialização
    const wakeUpMonitor = setTimeout(() => {
        if (!isServerAwake && localStatus) {
            localStatus.textContent = 'Despertando o estúdio na nuvem (pode levar 30s)...';
            localStatus.style.color = '#FF5722';
            
            if (joinButton) {
                joinButton.textContent = 'Aguardando Servidor...';
                joinButton.style.opacity = '0.7';
            }
        }
    }, 3000);

    socket.on('connect', () => {
        isServerAwake = true;
        clearTimeout(wakeUpMonitor);
        if (localStatus && !localStream) {
            localStatus.textContent = 'Servidor online. Aguardando seu áudio.';
            localStatus.style.color = '#666666';
        }
        if (joinButton && !joinButton.disabled) {
            joinButton.textContent = 'Conectar à Sala';
            joinButton.style.opacity = '1';
        }
    });

    // 2. Configuração WebRTC (STUN + TURN de Fallback)
    // As credenciais TURN nunca ficam hardcoded no JS: elas chegam via
    // wp_localize_script (macRoomData), configuradas no wp-config.php do site
    // (constantes MAC_TURN_URL / MAC_TURN_USERNAME / MAC_TURN_CREDENTIAL).
    // Sem TURN real configurado, participantes atrás de NAT restritivo ou
    // firewall corporativo falham silenciosamente ao conectar — o STUN sozinho
    // não resolve esses casos.
    const iceServers = {
        iceServers: [
            // STUN: Descobre os IPs públicos (Falha em NAT Estrito)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ]
    };

    if (macRoomData.turnUrl && macRoomData.turnUsername && macRoomData.turnCredential) {
        iceServers.iceServers.push({
            urls: macRoomData.turnUrl,
            username: macRoomData.turnUsername,
            credential: macRoomData.turnCredential
        });
    } else {
        console.warn(
            'Master Audio Collab: TURN não configurado. Conexões atrás de NAT ' +
            'restritivo ou firewall corporativo podem falhar silenciosamente. ' +
            'Defina MAC_TURN_URL, MAC_TURN_USERNAME e MAC_TURN_CREDENTIAL no wp-config.php.'
        );
    }

    // 3. Baixa latência: ajuste fino do SDP para áudio ao vivo (jam session)
    // Reduz o "ptime" (tamanho do pacote de áudio Opus) de 20ms (padrão) para
    // 10ms, diminuindo a latência de empacotamento. Custo: mais pacotes por
    // segundo (mais overhead de rede). Em conexões instáveis, considere voltar
    // para 20ms editando LOW_LATENCY_PTIME_MS abaixo.
    const LOW_LATENCY_PTIME_MS = 10;

    function reduceOpusLatency(sdp, ptimeMs) {
        if (/a=ptime:\d+/.test(sdp)) {
            return sdp.replace(/a=ptime:\d+/g, 'a=ptime:' + ptimeMs);
        }
        // Se não existir linha a=ptime, insere logo após o m=audio
        return sdp.replace(/(m=audio[^\r\n]*\r?\n)/, '$1a=ptime:' + ptimeMs + '\r\n');
    }

    window.addEventListener('mac-local-stream-ready', (e) => {
        localStream = e.detail.stream;
        
        if (localStatus) {
            localStatus.textContent = 'Áudio pronto para transmitir';
            localStatus.style.color = '#4CAF50';
        }
        
        for (let peerId in peers) {
            const peerConnection = peers[peerId];
            const senders = peerConnection.getSenders();
            senders.forEach(sender => peerConnection.removeTrack(sender));
            
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
    });

    if (joinButton) {
        joinButton.addEventListener('click', () => {
            if (!localStream) {
                alert('Selecione e permita o acesso à sua interface de áudio antes de entrar.');
                return;
            }
            if (!isServerAwake) {
                alert('Aguarde o servidor de sinalização despertar antes de conectar.');
                return;
            }
            
            joinButton.textContent = 'Conectado';
            joinButton.style.backgroundColor = '#4CAF50'; 
            joinButton.disabled = true;

            socket.emit('join-room', roomId, socket.id);
        });
    }

    // Orquestração P2P
    socket.on('user-connected', async (userId) => {
        const peerConnection = createPeerConnection(userId);
        peers[userId] = peerConnection;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const offer = await peerConnection.createOffer();
        offer.sdp = reduceOpusLatency(offer.sdp, LOW_LATENCY_PTIME_MS);
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, userId);
    });

    socket.on('offer', async (offer, senderId) => {
        const peerConnection = createPeerConnection(senderId);
        peers[senderId] = peerConnection;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const answer = await peerConnection.createAnswer();
        answer.sdp = reduceOpusLatency(answer.sdp, LOW_LATENCY_PTIME_MS);
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer, senderId);
    });

    socket.on('answer', async (answer, senderId) => {
        const peerConnection = peers[senderId];
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on('ice-candidate', async (candidate, senderId) => {
        const peerConnection = peers[senderId];
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on('user-disconnected', (userId) => {
        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        
        const userCard = document.getElementById(`mac-peer-${userId}`);
        if (userCard) {
            userCard.remove();
        }
    });

    function createPeerConnection(userId) {
        const peerConnection = new RTCPeerConnection(iceServers);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', event.candidate, userId);
            }
        };

        peerConnection.ontrack = (event) => {
            const remoteStream = event.streams[0];
            addRemoteParticipant(userId, remoteStream);

            // Pede ao navegador para minimizar o jitter buffer de reprodução.
            // Suporte: Chrome/Edge (Chromium). É uma troca consciente: reduz a
            // resiliência a instabilidade de rede em favor da menor latência
            // possível — o que é exatamente o que uma jam session precisa.
            if ('playoutDelayHint' in event.receiver) {
                try {
                    event.receiver.playoutDelayHint = 0;
                } catch (err) {
                    // Alguns navegadores expõem a propriedade mas a rejeitam; ignora.
                }
            }
        };

        monitorConnectionQuality(peerConnection, userId);

        return peerConnection;
    }

    // 4. Monitor de qualidade: detecta relay (TURN) e mede RTT periodicamente.
    // Conexões via relay quase sempre somam latência extra em relação a uma
    // conexão direta (host/srflx) — vale avisar visualmente quem está "atrás"
    // de um relay, já que isso pode explicar atraso percebido na jam.
    function monitorConnectionQuality(peerConnection, userId) {
        const interval = setInterval(async () => {
            if (peerConnection.connectionState === 'closed' || peerConnection.connectionState === 'failed') {
                clearInterval(interval);
                return;
            }

            try {
                const stats = await peerConnection.getStats();
                stats.forEach((report) => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
                        const localCandidate = stats.get(report.localCandidateId);
                        const remoteCandidate = stats.get(report.remoteCandidateId);
                        const usingRelay = (localCandidate && localCandidate.candidateType === 'relay') ||
                                            (remoteCandidate && remoteCandidate.candidateType === 'relay');
                        const rttMs = typeof report.currentRoundTripTime === 'number'
                            ? Math.round(report.currentRoundTripTime * 1000)
                            : null;

                        updatePeerQualityBadge(userId, usingRelay, rttMs);
                    }
                });
            } catch (err) {
                // getStats() pode falhar momentaneamente durante renegociação; ignora.
            }
        }, 3000);
    }

    function updatePeerQualityBadge(userId, usingRelay, rttMs) {
        const card = document.getElementById(`mac-peer-${userId}`);
        if (!card) return;

        let badge = card.querySelector('.mac-quality-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'mac-quality-badge';
            badge.style.fontSize = '0.75rem';
            badge.style.marginTop = '4px';
            card.appendChild(badge);
        }

        const rttLabel = rttMs !== null ? `${rttMs}ms` : '—';
        if (usingRelay) {
            badge.textContent = `⚠️ Via relay (TURN) · RTT ${rttLabel}`;
            badge.style.color = '#FF5722';
        } else {
            badge.textContent = `Conexão direta · RTT ${rttLabel}`;
            badge.style.color = '#4CAF50';
        }
    }

    function addRemoteParticipant(userId, stream) {
        if (document.getElementById(`mac-peer-${userId}`)) return;

        const card = document.createElement('div');
        card.className = 'mac-participant-card';
        card.id = `mac-peer-${userId}`;

        const avatar = document.createElement('div');
        avatar.className = 'mac-avatar';
        avatar.textContent = 'Músico'; 

        const status = document.createElement('div');
        status.className = 'mac-status-indicator';
        status.textContent = 'Som conectado';
        status.style.color = '#FF5722'; 

        const audioElement = document.createElement('audio');
        audioElement.srcObject = stream;
        audioElement.autoplay = true;
        audioElement.style.display = 'none';

        card.appendChild(avatar);
        card.appendChild(status);
        card.appendChild(audioElement);

        participantsContainer.appendChild(card);
    }
});
