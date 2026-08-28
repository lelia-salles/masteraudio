<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>
<div class="mac-audio-room-wrapper" id="mac-room-<?php echo esc_attr( $room_id ); ?>">
    
    <!-- Hero Section / Cabeçalho -->
    <div class="mac-room-hero">
        <h2 class="mac-title-belleza">Estúdio Virtual</h2>
        <p class="mac-subtitle-noto">Aqui, a técnica encontra propósito. Conecte sua interface e vamos ao som.</p>
    </div>

    <!-- Grid de Participantes (Divisão por 3) -->
    <div class="mac-participants-grid" id="mac-participants-container">
        <!-- O avatar e o status de áudio do próprio usuário (Local) -->
        <div class="mac-participant-card local-participant">
            <div class="mac-avatar">Você</div>
            <div class="mac-status-indicator">Aguardando conexão...</div>
        </div>
        <!-- Os músicos remotos serão injetados aqui via JavaScript -->
    </div>

    <!-- Barra de Controles de Hardware e Conexão -->
    <?php 
    $controls_path = MAC_PLUGIN_DIR . 'templates/controls-layout.php';
    if ( file_exists( $controls_path ) ) {
        include $controls_path;
    }
    ?>
    
</div>
