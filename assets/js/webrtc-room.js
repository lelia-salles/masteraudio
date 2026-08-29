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
    const iceServers = {
        iceServers: [
            // STUN: Descobre os IPs públicos (Falha em NAT Estrito)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            
            // TURN: Retransmite o áudio via nuvem caso o P2P seja bloqueado por firewalls
            // Substitua estas credenciais por um serviço real (ex: Metered, Twilio ou sua instância Coturn na AWS)
            {
                urls: 'turn:sua-url-turn.com:3478',
                username: 'SEU_USUARIO_TURN',
                credential: 'SUA_SENHA_TURN'
            }
        ]
    };

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
        };

        return peerConnection;
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
