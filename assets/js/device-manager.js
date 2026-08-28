/**
 * Master Audio Collab - Gerenciador de Dispositivos e Captura (Hardware)
 */

class MACDeviceManager {
    constructor() {
        this.currentStream = null;
        this.musicModeEnabled = false;
        this.isMuted = false;
        this.selectedDeviceId = 'default';

        // Mapeamento dos elementos da interface
        this.ui = {
            select: document.getElementById('mac-audio-input'),
            btnMusicMode: document.getElementById('mac-btn-music-mode'),
            btnMute: document.getElementById('mac-btn-mute')
        };

        this.initListeners();
    }

    async init() {
        try {
            // Um gatilho inicial pedindo permissão de áudio genérica é necessário
            // para que o navegador revele os nomes reais das placas de som na lista
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            await this.loadDevices();
            await this.startStream();
        } catch (error) {
            console.error('Erro ao acessar o microfone:', error);
            if (this.ui.select) {
                this.ui.select.innerHTML = '<option value="">Acesso negado ao microfone</option>';
            }
        }
    }

    async loadDevices() {
        if (!this.ui.select) return;

        const devices = await navigator.mediaDevices.enumerateDevices();
        // Filtra apenas as entradas de áudio (microfones/interfaces)
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        this.ui.select.innerHTML = '';
        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            // Se o navegador não retornar um label (por restrição de privacidade), usamos um fallback
            option.text = device.label || `Entrada de Áudio ${this.ui.select.length + 1}`;
            this.ui.select.appendChild(option);
        });
    }

    async startStream() {
        // Se já existe um stream rodando, nós o interrompemos antes de abrir um novo
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
        }

        // É aqui que a mágica da fidelidade de áudio acontece
        const constraints = {
            audio: {
                deviceId: this.selectedDeviceId !== 'default' ? { exact: this.selectedDeviceId } : undefined,
                echoCancellation: !this.musicModeEnabled,
                noiseSuppression: !this.musicModeEnabled,
                autoGainControl: !this.musicModeEnabled
            }
        };

        try {
            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.applyMuteState();
            
            // Dispara um evento global para avisar ao webrtc-room.js que o áudio local está pronto (ou mudou)
            window.dispatchEvent(new CustomEvent('mac-local-stream-ready', { 
                detail: { stream: this.currentStream } 
            }));
            
        } catch (error) {
            console.error('Erro ao iniciar o stream com as constraints aplicadas:', error);
        }
    }

    initListeners() {
        // Escuta a troca de microfone no dropdown
        if (this.ui.select) {
            this.ui.select.addEventListener('change', (e) => {
                this.selectedDeviceId = e.target.value;
                this.startStream();
            });
        }

        // Alterna entre modo voz (com filtros) e modo música (som puro)
        if (this.ui.btnMusicMode) {
            this.ui.btnMusicMode.addEventListener('click', () => {
                this.musicModeEnabled = !this.musicModeEnabled;
                this.ui.btnMusicMode.textContent = `Modo Música: ${this.musicModeEnabled ? 'ON' : 'OFF'}`;
                
                // Adiciona um feedback visual mudando a cor do botão com classes CSS
                if (this.musicModeEnabled) {
                    this.ui.btnMusicMode.classList.add('mac-btn-primary');
                    this.ui.btnMusicMode.classList.remove('mac-btn-outline');
                } else {
                    this.ui.btnMusicMode.classList.add('mac-btn-outline');
                    this.ui.btnMusicMode.classList.remove('mac-btn-primary');
                }
                
                this.startStream();
            });
        }

        // Escuta o botão de mute
        if (this.ui.btnMute) {
            this.ui.btnMute.addEventListener('click', () => {
                this.isMuted = !this.isMuted;
                this.ui.btnMute.innerHTML = `<span class="icon">${this.isMuted ? '🔇' : '🎙️'}</span> ${this.isMuted ? 'Desmutar' : 'Mutar'}`;
                this.applyMuteState();
            });
        }
    }

    applyMuteState() {
        if (this.currentStream) {
            this.currentStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
        }
    }
}

// Instancia a classe e a torna global para ser acessada por outros scripts
window.macDeviceManager = new MACDeviceManager();

document.addEventListener('DOMContentLoaded', () => {
    window.macDeviceManager.init();
});
