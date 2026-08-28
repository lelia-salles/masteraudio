/**
 * Master Audio Collab - Motor WebRTC e Sinalização
 */
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se os dados do WordPress foram injetados corretamente
    if (typeof macRoomData === 'undefined' || typeof io === 'undefined') {
        console.error('Master Audio Collab: Dados de inicialização ou Socket.io ausentes.');
        return;
    }

    const socket = io(macRoomData.signalingServer);
    const roomId = macRoomData.roomId;
    
    // Armazena as conexões P2P com outros músicos
    const peers = {}; 
    
    // O stream de áudio local capturado pelo device-manager.js
    let localStream = null;
    
    // Elementos DOM 
    const participantsContainer = document.getElementById('mac-participants-container');
    const joinButton = document.getElementById('mac-btn-join');

    // Configuração de servidores STUN para descobrir IPs públicos na rede P2P
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    // 1. Escuta o hardware local (disparado pelo device-manager.js)
    window.addEventListener('mac-local-stream-ready', (e) => {
        localStream = e.detail.stream;
        
        // Atualiza o card local na interface
        const localStatus = document.querySelector('.local-participant .mac-status-indicator');
        if (localStatus) {
            localStatus.textContent = 'Áudio pronto para transmitir';
            localStatus.style.color = '#4CAF50';
        }
        
        // Se já houver conexões ativas, atualiza as trilhas de áudio
        for (let peerId in peers) {
            const peerConnection = peers[peerId];
            const senders = peerConnection.getSenders();
            senders.forEach(sender => peerConnection.removeTrack(sender));
            
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
    });

    // 2. Ação de Conectar à Sala
    if (joinButton) {
        joinButton.addEventListener('click', () => {
            if (!localStream) {
                alert('Selecione e permita o acesso à sua interface de áudio antes de entrar.');
                return;
            }
            
            // Feedback visual alinhado à marca (Laranja)
            joinButton.textContent = 'Conectado';
            joinButton.style.backgroundColor = '#4CAF50'; 
            joinButton.disabled = true;

            // Pede ao servidor Node.js para entrar na sala isolada
            socket.emit('join-room', roomId, socket.id);
        });
    }

    // 3. Orquestração WebRTC (Sinalização)

    // Quando um NOVO músico entra na sala
    socket.on('user-connected', async (userId) => {
        const peerConnection = createPeerConnection(userId);
        peers[userId] = peerConnection;

        // Adiciona nosso áudio para o novo usuário
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Cria a oferta de conexão P2P
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, userId);
    });

    // Quando recebemos uma OFERTA de um músico que já estava lá
    socket.on('offer', async (offer, senderId) => {
        const peerConnection = createPeerConnection(senderId);
        peers[senderId] = peerConnection;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Responde à oferta
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer, senderId);
    });

    // Quando recebemos a RESPOSTA 
    socket.on('answer', async (answer, senderId) => {
        const peerConnection = peers[senderId];
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    // Troca de rotas de rede (ICE)
    socket.on('ice-candidate', async (candidate, senderId) => {
        const peerConnection = peers[senderId];
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    // Quando um músico sai
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

    // 4. Função Auxiliar: Criar Conexão e UI
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

    // 5. Renderização do Músico Remoto no DOM
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
