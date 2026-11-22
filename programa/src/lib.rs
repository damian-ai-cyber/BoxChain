use anchor_lang::prelude::*;

declare_id!("Hp1EuNXPu3fGuZa94uTri6TJLD9KdHbH69MXAQDdxvw1");

#[program]
pub mod torneos_box {
    use super::*;

    // ── PROMOTORA (Cuenta central para contadores de PDAs) ───────────
    pub fn inicializar_promotora(ctx: Context<InicializarPromotora>) -> Result<()> {
        let promotora = &mut ctx.accounts.promotora;
        promotora.propietario = ctx.accounts.propietario.key();
        promotora.boxeador_counter = 0;
        promotora.torneo_counter = 0;
        promotora.pelea_counter = 0;
        Ok(())
    }

    // ── BOXEADOR ────────────────────────────────────────────────────────────
    pub fn registrar_boxeador(
        ctx: Context<RegistrarBoxeador>,
        nombre: String,
        peso: u64,
        categoria: Categoria,
    ) -> Result<()> {
        require!(!nombre.is_empty(), Errores::NombreVacio);
        require!(nombre.len() <= 50, Errores::NombreMuyLargo);
        require!(peso > 0, Errores::PesoInvalido);

        let boxeador = &mut ctx.accounts.boxeador;
        let promotora = &mut ctx.accounts.promotora;

        boxeador.id_boxeador = promotora.boxeador_counter;
        boxeador.promotora = promotora.key();
        boxeador.nombre = nombre;
        boxeador.peso = peso;
        boxeador.categoria = categoria;
        boxeador.victorias = 0;
        boxeador.derrotas = 0;
        boxeador.empates = 0;
        boxeador.activo = true;
        boxeador.peleas_registradas = 0; 
        
        promotora.boxeador_counter += 1; 
        Ok(())
    }

    pub fn eliminar_boxeador(ctx: Context<EliminarBoxeador>) -> Result<()> {
        let boxeador = &ctx.accounts.boxeador;
        // REGLA DE NEGOCIO: No se puede eliminar si tiene peleas
        require!(boxeador.peleas_registradas == 0, Errores::BoxeadorConPeleas);
        Ok(())
    }

    // ── TORNEO ──────────────────────────────────────────────────────────────
    pub fn crear_torneo(
        ctx: Context<CrearTorneo>,
        nombre: String,
        sede: String,
        categoria: Categoria,
    ) -> Result<()> {
        require!(!nombre.is_empty(), Errores::NombreVacio);
        
        let torneo = &mut ctx.accounts.torneo;
        let promotora = &mut ctx.accounts.promotora;

        torneo.id_torneo = promotora.torneo_counter;
        torneo.promotora = promotora.key();
        torneo.nombre = nombre;
        torneo.sede = sede;
        torneo.categoria = categoria;
        torneo.activo = true;

        promotora.torneo_counter += 1;
        Ok(())
    }

    // ── PELEA ───────────────────────────────────────────────────────────────
    pub fn registrar_pelea(
        ctx: Context<RegistrarPelea>,
    ) -> Result<()> {
        require!(ctx.accounts.torneo.activo, Errores::TorneoYaFinalizado);
        require!(ctx.accounts.boxeador_rojo.activo, Errores::BoxeadorInactivo);
        require!(ctx.accounts.boxeador_azul.activo, Errores::BoxeadorInactivo);

        let pelea = &mut ctx.accounts.pelea;
        let promotora = &mut ctx.accounts.promotora;

        pelea.id_pelea = promotora.pelea_counter;
        pelea.promotora = promotora.key();
        pelea.boxeador_rojo = ctx.accounts.boxeador_rojo.key();
        pelea.boxeador_azul = ctx.accounts.boxeador_azul.key();
        pelea.torneo = ctx.accounts.torneo.key();
        pelea.resultado = Resultado::Pendiente;

        // Sumamos las peleas a los boxeadores
        ctx.accounts.boxeador_rojo.peleas_registradas += 1;
        ctx.accounts.boxeador_azul.peleas_registradas += 1;

        promotora.pelea_counter += 1;
        Ok(())
    }

    pub fn eliminar_pelea(ctx: Context<EliminarPelea>) -> Result<()> {
        // Restamos las peleas al eliminar
        ctx.accounts.boxeador_rojo.peleas_registradas = ctx.accounts.boxeador_rojo.peleas_registradas.saturating_sub(1);
        ctx.accounts.boxeador_azul.peleas_registradas = ctx.accounts.boxeador_azul.peleas_registradas.saturating_sub(1);
        Ok(())
    }
}

// ── ENUMS Y STRUCTS ──────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum Categoria { Minimosca, Mosca, Gallo, Pluma, Ligero, Superligero, Welter, Superwelter, Mediano, Pesado }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum Resultado { Pendiente, RojoGana, AzulGana, Empate }

#[account]
#[derive(InitSpace)]
pub struct Promotora {
    pub propietario: Pubkey,
    pub boxeador_counter: u32,
    pub torneo_counter: u32,
    pub pelea_counter: u32,
}

#[account]
#[derive(InitSpace)]
pub struct Boxeador {
    pub id_boxeador: u32,
    pub promotora: Pubkey,
    #[max_len(50)]
    pub nombre: String,
    pub peso: u64,
    pub categoria: Categoria,
    pub victorias: u32,
    pub derrotas: u32,
    pub empates: u32,
    pub activo: bool,
    pub peleas_registradas: u32, 
}

#[account]
#[derive(InitSpace)]
pub struct Torneo {
    pub id_torneo: u32,
    pub promotora: Pubkey,
    #[max_len(50)]
    pub nombre: String,
    #[max_len(50)]
    pub sede: String,
    pub categoria: Categoria,
    pub activo: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Pelea {
    pub id_pelea: u32,
    pub promotora: Pubkey,
    pub boxeador_rojo: Pubkey,
    pub boxeador_azul: Pubkey,
    pub torneo: Pubkey,
    pub resultado: Resultado,
}

// ── CONTEXTOS CON PDAs ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InicializarPromotora<'info> {
    #[account(
        init,
        payer = propietario,
        space = 8 + Promotora::INIT_SPACE,
        seeds = [b"promotora", propietario.key().as_ref()],
        bump
    )]
    pub promotora: Account<'info, Promotora>,
    #[account(mut)]
    pub propietario: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegistrarBoxeador<'info> {
    #[account(mut, has_one = propietario)]
    pub promotora: Account<'info, Promotora>,
    #[account(
        init,
        payer = propietario,
        space = 8 + Boxeador::INIT_SPACE,
        seeds = [b"boxeador", promotora.key().as_ref(), &promotora.boxeador_counter.to_le_bytes()],
        bump
    )]
    pub boxeador: Account<'info, Boxeador>,
    #[account(mut)]
    pub propietario: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EliminarBoxeador<'info> {
    #[account(mut, has_one = propietario)]
    pub promotora: Account<'info, Promotora>,
    #[account(mut, has_one = promotora, close = propietario)]
    pub boxeador: Account<'info, Boxeador>,
    #[account(mut)]
    pub propietario: Signer<'info>,
}

#[derive(Accounts)]
pub struct CrearTorneo<'info> {
    #[account(mut, has_one = propietario)]
    pub promotora: Account<'info, Promotora>,
    #[account(
        init,
        payer = propietario,
        space = 8 + Torneo::INIT_SPACE,
        seeds = [b"torneo", promotora.key().as_ref(), &promotora.torneo_counter.to_le_bytes()],
        bump
    )]
    pub torneo: Account<'info, Torneo>,
    #[account(mut)]
    pub propietario: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegistrarPelea<'info> {
    #[account(mut, has_one = propietario)]
    pub promotora: Account<'info, Promotora>,
    #[account(
        init,
        payer = propietario,
        space = 8 + Pelea::INIT_SPACE,
        seeds = [b"pelea", promotora.key().as_ref(), &promotora.pelea_counter.to_le_bytes()],
        bump
    )]
    pub pelea: Account<'info, Pelea>,
    #[account(mut, has_one = promotora)]
    pub torneo: Account<'info, Torneo>,
    #[account(mut, has_one = promotora)]
    pub boxeador_rojo: Account<'info, Boxeador>,
    #[account(mut, has_one = promotora)]
    pub boxeador_azul: Account<'info, Boxeador>,
    #[account(mut)]
    pub propietario: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EliminarPelea<'info> {
    #[account(mut, has_one = propietario)]
    pub promotora: Account<'info, Promotora>,
    #[account(mut, has_one = promotora, close = propietario)]
    pub pelea: Account<'info, Pelea>,
    #[account(mut, has_one = promotora)]
    pub boxeador_rojo: Account<'info, Boxeador>,
    #[account(mut, has_one = promotora)]
    pub boxeador_azul: Account<'info, Boxeador>,
    #[account(mut)]
    pub propietario: Signer<'info>,
}

// ── ERRORES ──────────────────────────────────────────────────────────────────
#[error_code]
pub enum Errores {
    #[msg("El nombre no puede estar vacío.")]
    NombreVacio,
    #[msg("El nombre excede los 50 caracteres.")]
    NombreMuyLargo,
    #[msg("El peso debe ser mayor a cero.")]
    PesoInvalido,
    #[msg("El torneo ya fue finalizado.")]
    TorneoYaFinalizado,
    #[msg("El boxeador está inactivo.")]
    BoxeadorInactivo,
    #[msg("No se puede eliminar el boxeador porque tiene peleas registradas.")]
    BoxeadorConPeleas,
}