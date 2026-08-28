<?php
/**
 * Plugin Name: Master Audio Collab
 * Description: Plataforma de colaboração de áudio em tempo real (WebRTC) com suporte a múltiplas salas e rede multisite.
 * Version: 1.0.0
 * Author: Lélia Salles
 * Text Domain: master-audio-collab
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Proteção contra acesso direto
}

// Define constantes para facilitar o mapeamento de caminhos
define( 'MAC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MAC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Hook de ativação preparado para varredura Multisite
register_activation_hook( __FILE__, 'mac_activate_plugin' );

function mac_activate_plugin( $network_wide ) {
    if ( is_multisite() && $network_wide ) {
        // Guarda o ID do site atual para retornar a ele no final
        $current_blog = get_current_blog_id();
        
        // Itera sobre todos os sites da rede
        $sites = get_sites();
        
        foreach ( $sites as $site ) {
            switch_to_blog( $site->blog_id );
            mac_setup_site();
        }
        
        // Restaura para o site original
        switch_to_blog( $current_blog );
    } else {
        // Ativação em um site único
        mac_setup_site();
    }
}

// Lógica aplicada a cada sub-site durante a ativação
function mac_setup_site() {
    // Configura a URL do servidor Node.js como uma opção global da rede
    if ( ! get_site_option( 'mac_signaling_server_url' ) ) {
        update_site_option( 'mac_signaling_server_url', 'http://localhost:3000' );
    }
}

// Os arquivos de backend serão incluídos aqui na sequência
require_once MAC_PLUGIN_DIR . 'includes/class-frontend.php';

// require_once MAC_PLUGIN_DIR . 'includes/class-signaling.php';
