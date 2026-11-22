import { address, createNoopSigner, type Address } from '@solana/kit';
import type { Connection } from '@solana/web3.js';
import {
  Categoria,
  fetchMaybePromotora,
  getInicializarPromotoraInstruction,
  getRegistrarBoxeadorInstruction,
  getEliminarBoxeadorInstruction,
  getCrearTorneoInstruction,
  getRegistrarPeleaInstruction,
  getEliminarPeleaInstruction,
} from '../../clients/js/src/generated';
import { rpc } from './conexion';
import { pdaPromotora, pdaBoxeador, pdaTorneo, pdaPelea } from './pdas';
import { enviar, type WalletFirma, type OpcionesEnvio } from './tx';
import { comprobarConfiguracion } from './seguridad';

export function direccionDe(wallet: Pick<WalletFirma, 'publicKey'>): Address {
  if (!wallet.publicKey) throw new Error('Conecta tu wallet primero.');
  return address(wallet.publicKey.toBase58());
}

function firmante(wallet: WalletFirma) {
  comprobarConfiguracion();
  return createNoopSigner(direccionDe(wallet));
}

async function obtenerPromotora(propietario: Address) {
  const promotora = pdaPromotora(propietario);
  const cuenta = await fetchMaybePromotora(rpc, promotora);
  if (!cuenta.exists) throw new Error('Inicializa la promotora primero.');
  return { promotora, data: cuenta.data };
}

export async function inicializarPromotora(wallet: WalletFirma, connection: Connection, opciones?: OpcionesEnvio): Promise<string> {
  const propietario = firmante(wallet);
  const promotora = pdaPromotora(propietario.address);
  const ix = getInicializarPromotoraInstruction({ promotora, propietario });
  return enviar(ix, wallet, connection, opciones);
}

export async function registrarBoxeador(
  wallet: WalletFirma,
  connection: Connection,
  nombre: string,
  peso: number,
  categoria: Categoria,
  opciones?: OpcionesEnvio
): Promise<string> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) throw new Error('El nombre no puede estar vacío.');
  if (nombreLimpio.length > 50) throw new Error('El nombre excede los 50 caracteres.');
  if (peso <= 0) throw new Error('El peso debe ser mayor a cero.');

  const propietario = firmante(wallet);
  const { promotora, data } = await obtenerPromotora(propietario.address);
  const boxeador = pdaBoxeador(promotora, data.boxeadorCounter);
  const ix = getRegistrarBoxeadorInstruction({
    promotora,
    boxeador,
    propietario,
    nombre: nombreLimpio,
    peso: BigInt(Math.round(peso)),
    categoria,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function eliminarBoxeador(
  wallet: WalletFirma,
  connection: Connection,
  idBoxeador: number,
  opciones?: OpcionesEnvio
): Promise<string> {
  const propietario = firmante(wallet);
  const promotora = pdaPromotora(propietario.address);
  const boxeador = pdaBoxeador(promotora, idBoxeador);
  const ix = getEliminarBoxeadorInstruction({ promotora, boxeador, propietario });
  return enviar(ix, wallet, connection, opciones);
}

export async function crearTorneo(
  wallet: WalletFirma,
  connection: Connection,
  nombre: string,
  sede: string,
  categoria: Categoria,
  opciones?: OpcionesEnvio
): Promise<string> {
  const nombreLimpio = nombre.trim();
  const sedeLimpia = sede.trim();
  if (!nombreLimpio) throw new Error('El nombre del torneo no puede estar vacío.');
  if (!sedeLimpia) throw new Error('La sede no puede estar vacía.');

  const propietario = firmante(wallet);
  const { promotora, data } = await obtenerPromotora(propietario.address);
  const torneo = pdaTorneo(promotora, data.torneoCounter);
  const ix = getCrearTorneoInstruction({
    promotora,
    torneo,
    propietario,
    nombre: nombreLimpio,
    sede: sedeLimpia,
    categoria,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function registrarPelea(
  wallet: WalletFirma,
  connection: Connection,
  idTorneo: number,
  idBoxeadorRojo: number,
  idBoxeadorAzul: number,
  opciones?: OpcionesEnvio
): Promise<string> {
  if (idBoxeadorRojo === idBoxeadorAzul) throw new Error('El boxeador rojo y azul deben ser distintos.');

  const propietario = firmante(wallet);
  const { promotora, data } = await obtenerPromotora(propietario.address);
  const pelea = pdaPelea(promotora, data.peleaCounter);
  const torneo = pdaTorneo(promotora, idTorneo);
  const boxeadorRojo = pdaBoxeador(promotora, idBoxeadorRojo);
  const boxeadorAzul = pdaBoxeador(promotora, idBoxeadorAzul);

  const ix = getRegistrarPeleaInstruction({
    promotora,
    pelea,
    torneo,
    boxeadorRojo,
    boxeadorAzul,
    propietario,
  });
  return enviar(ix, wallet, connection, opciones);
}

export async function eliminarPelea(
  wallet: WalletFirma,
  connection: Connection,
  idPelea: number,
  boxeadorRojo: Address,
  boxeadorAzul: Address,
  opciones?: OpcionesEnvio
): Promise<string> {
  const propietario = firmante(wallet);
  const promotora = pdaPromotora(propietario.address);
  const pelea = pdaPelea(promotora, idPelea);
  const ix = getEliminarPeleaInstruction({
    promotora,
    pelea,
    boxeadorRojo,
    boxeadorAzul,
    propietario,
  });
  return enviar(ix, wallet, connection, opciones);
}