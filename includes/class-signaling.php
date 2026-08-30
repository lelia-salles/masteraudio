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
     * Gera um token assinado que autoriza o usuário atual a entrar em uma
     * sala específica no servidor de sinalização Node.js.
     *
     * O servidor Node NÃO tem acesso ao banco de dados do WordPress, então em
     * vez de wp_create_nonce() (que só pode ser verificado dentro do próprio
     * WordPress via wp_verify_nonce()), assinamos um payload simples com um
     * segredo compartilhado (constante MAC_SIGNALING_SECRET). O servidor Node
     * guarda o mesmo segredo em uma variável de ambiente e recalcula a
     * assinatura — sem precisar bater no banco a cada conexão.
     *
     * Formato do token: "{payload_base64url}.{assinatura_hmac_sha256_hex}"
     *
     * IMPORTANTE: $isolated_room_id deve ser o ID JÁ isolado por sub-site
     * (ex: "site-2-sala-geral"), não o room_id "cru" do shortcode — caso
     * contrário um token emitido em um sub-site poderia ser reaproveitado em
     * outro que use o mesmo nome de sala.
     *
     * @param string $isolated_room_id ID da sala isolado por site.
     * @return string|false Token assinado, ou false se o acesso for negado.
     */
    public static function verify_room_access( $isolated_room_id ) {
        // Regra de autorização: apenas usuários logados podem acessar as salas.
        if ( ! is_user_logged_in() ) {
            return false;
        }

        if ( ! defined( 'MAC_SIGNALING_SECRET' ) || empty( MAC_SIGNALING_SECRET ) ) {
            // Sem segredo compartilhado configurado, o servidor de sinalização
            // não tem como validar o token de forma independente. Falhamos de
            // forma SEGURA (negando o acesso) em vez de deixar a sala aberta
            // para qualquer um que descubra o room_id no HTML da página.
            if ( function_exists( 'error_log' ) ) {
                error_log( 'Master Audio Collab: MAC_SIGNALING_SECRET não definido no wp-config.php. Acesso às salas negado até ser configurado.' );
            }
            return false;
        }

        $payload = array(
            'room' => $isolated_room_id,
            'user' => get_current_user_id(),
            'exp'  => time() + HOUR_IN_SECONDS,
        );

        $payload_b64 = self::base64url_encode( wp_json_encode( $payload ) );
        $signature   = hash_hmac( 'sha256', $payload_b64, MAC_SIGNALING_SECRET );

        return $payload_b64 . '.' . $signature;
    }

    private static function base64url_encode( $data ) {
        return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
    }
}

// Inicializa a classe
new MAC_Signaling();