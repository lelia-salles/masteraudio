<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit; // Proteção contra acesso direto
}

class MAC_Frontend {

    public function __construct() {
        // Registra o shortcode [master_audio_room id="nome-da-sala"]
        add_shortcode( 'master_audio_room', array( $this, 'render_audio_room' ) );
        
        // Registra os scripts e estilos no frontend
        add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
    }

    public function register_assets() {
        // 1. Importação da Tipografia da Marca
        // Noto Sans (acessibilidade/minimalismo) e Belleza (títulos elegantes)
        wp_enqueue_style( 
            'mac-google-fonts', 
            'https://fonts.googleapis.com/css2?family=Belleza&family=Noto+Sans:ital,wght@0,400;0,700;1,400&display=swap', 
            array(), 
            null 
        );

        // 2. Estilos principais da sala
        wp_register_style( 'mac-room-style', MAC_PLUGIN_URL . 'assets/css/style.css', array(), '1.0.0' );

        // 3. Scripts de lógica WebRTC e hardware
        wp_register_script( 'mac-socket-io', 'https://cdn.socket.io/4.7.2/socket.io.min.js', array(), null, true );
        wp_register_script( 'mac-device-manager', MAC_PLUGIN_URL . 'assets/js/device-manager.js', array(), '1.0.0', true );
        wp_register_script( 'mac-webrtc-room', MAC_PLUGIN_URL . 'assets/js/webrtc-room.js', array( 'mac-socket-io', 'mac-device-manager' ), '1.0.0', true );
    }

    public function render_audio_room( $atts ) {
        // Define 'sala-geral' como padrão caso o ID não seja fornecido
        $atts = shortcode_atts( array(
            'id' => 'sala-geral',
        ), $atts, 'master_audio_room' );

        $room_id = sanitize_text_field( $atts['id'] );
        
        // Lógica Multisite: Previne colisão de salas entre sub-sites
        $blog_id = is_multisite() ? get_current_blog_id() : '1';
        $isolated_room_id = 'site-' . $blog_id . '-' . $room_id;

        // Carrega os assets apenas quando o shortcode for chamado
        wp_enqueue_style( 'mac-room-style' );
        wp_enqueue_script( 'mac-socket-io' );
        wp_enqueue_script( 'mac-device-manager' );
        wp_enqueue_script( 'mac-webrtc-room' );

        // Busca a URL do servidor Node.js configurada na rede
        $signaling_server = get_site_option( 'mac_signaling_server_url', 'http://localhost:3000' );
        
        // Envia dados seguros do WordPress para o JavaScript
        wp_localize_script( 'mac-webrtc-room', 'macRoomData', array(
            'signalingServer' => $signaling_server,
            'roomId'          => $isolated_room_id,
            'brandVoice'      => 'Aqui, a técnica encontra propósito.'
        ) );

        ob_start();
        $this->load_room_template();
        return ob_get_clean();
    }

    private function load_room_template() {
        // Tenta carregar o template modular da pasta templates/
        $template_path = MAC_PLUGIN_DIR . 'templates/room-layout.php';
        
        if ( file_exists( $template_path ) ) {
            include $template_path;
        } else {
            // Estrutura de fallback alinhada à identidade visual e estilo "Hero"
            echo '<div class="mac-audio-room" style="font-family: \'Noto Sans\', sans-serif; background-color: #FAFAFA; color: #333333; padding: 60px 40px; border-radius: 8px; text-align: center; border-top: 4px solid #FF5722; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">';
            echo '<h2 style="font-family: \'Belleza\', sans-serif; color: #1A1A1A; font-size: 2.5rem; margin-bottom: 15px;">Conecte-se ao Som</h2>';
            echo '<p style="font-size: 1.1rem; color: #666666; margin-bottom: 30px;">Sua carreira não é improviso. É composição. Preparando seu áudio...</p>';
            echo '<button class="mac-btn-primary" style="background-color: #FF5722; color: #FFFFFF; border: none; padding: 15px 35px; border-radius: 50px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: background-color 0.3s ease;">Entrar na Sala</button>';
            echo '</div>';
        }
    }
}

// Inicializa a classe
new MAC_Frontend();
