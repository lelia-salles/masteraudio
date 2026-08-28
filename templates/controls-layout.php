<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>
<div class="mac-controls-bar">
    
    <!-- Seletor de Interface de Áudio -->
    <div class="mac-device-group">
        <label for="mac-audio-input" class="mac-label-noto">Sua Interface / Microfone:</label>
        <select id="mac-audio-input" class="mac-select-input">
            <option value="">Buscando dispositivos...</option>
        </select>
    </div>

    <!-- Controles de Ação -->
    <div class="mac-action-group">
        
        <!-- Botão Secundário (Cinza) -->
        <button id="mac-btn-mute" class="mac-btn mac-btn-secondary">
            <span class="icon">🎙️</span> Mutar
        </button>
        
        <!-- Botão de Inovação Técnica -->
        <button id="mac-btn-music-mode" class="mac-btn mac-btn-outline" title="Desativa cancelamento de eco do navegador para captar instrumentos puros">
            Modo Música: OFF
        </button>

        <!-- Ponto Focal / Chamada de Ação (Laranja) -->
        <button id="mac-btn-join" class="mac-btn mac-btn-primary">
            Conectar à Sala
        </button>
        
    </div>
</div>
