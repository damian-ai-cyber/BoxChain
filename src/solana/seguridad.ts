import type { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import programa from '../config/programa.json';
import { TORNEOS_BOX_PROGRAM_ADDRESS } from '../../clients/js/src/generated';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

const PROGRAM_ID_ACTIVO = 'Hp1EuNXPu3fGuZa94uTri6TJLD9KdHbH69MXAQDdxvw1';

export function comprobarConfiguracion() {
  if (programa.esReferencia) {
    throw new Error('Importa el IDL de tu programa para habilitar las operaciones. Consulta docs/IDL-Y-PLAYGROUND.md.');
  }
}

export async function comprobarDevnet(connection: Pick<Connection, 'getGenesisHash'>) {
  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    throw new Error('Este proyecto solo permite escribir en Devnet. Revisa el RPC antes de continuar.');
  }
}

export async function comprobarPrograma(connection: Connection) {
  comprobarConfiguracion();
  await comprobarDevnet(connection);
const id = PROGRAM_ID_ACTIVO;  const cuenta = await connection.getAccountInfo(new PublicKey(id), 'confirmed');
  if (!cuenta?.executable) {
    throw new Error('El programa indicado no está desplegado en este RPC de Devnet. Revisa el Program ID y tu despliegue.');
  }
}
