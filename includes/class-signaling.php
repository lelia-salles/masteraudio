<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit; // Proteção contra acesso direto
}

class MAC_Signaling {

    public function __construct() {
        // Registra o Custom Post Type para gerenciamento das salas no painel
        add_action( 'init', array( $this, 'register_audio_rooms_cpt' ) );
    }

    public function register_audio_rooms_cpt() {
        $labels = array(
            'name'                  => 'Salas de Áudio',
            'singular_name'         => 'Sala de Áudio',
            'menu_name'             => 'Estúdio Virtual',
            'add_new'               => 'Adicionar Nova Sala',
            'add_new_item'          => 'Adicionar Nova Sala de Áudio',
            'edit_item'             => 'Editar Sala',
            'all_items'             => 'Todas as Salas',
        );

        $args = array(
            'labels'             => $labels,
            'public'             => true,
            'publicly_queryable' => false,
            'show_ui'            => true,
            'show_in_menu'       => true,
            'query_var'          => true,
            'rewrite'            => array( 'slug' => 'sala-audio' ),
            'capability_type'    => 'post',
            'has_archive'        => false,
            'hierarchical'       => false,
            'menu_position'      => 20,
            'menu_icon'          => 'dashicons-microphone',
            'supports'           => array( 'title', 'custom-fields' ),
        );

        register_post_type( 'mac_audio_room', $args );
    }

    /**
     * Verifica se o usuário atual tem permissão para acessar a sala.
     * Retorna um token (nonce) se autorizado, ou false se negado.
     */
    public static function verify_room_access( $room_id ) {
        // Exemplo de regra: Apenas usuários logados podem acessar as salas
        if ( ! is_user_logged_in() ) {
            return false;
        }

        // Gera um token de segurança único para a sessão do usuário nesta sala específica
        $token = wp_create_nonce( 'mac_access_' . $room_id . '_' . get_current_user_id() );
        
        return $token;
    }
}

// Inicializa a classe
new MAC_Signaling();
