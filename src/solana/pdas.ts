import { address, type Address } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";
import { s } from "./seeds";

const PROGRAM_ID = new PublicKey("Hp1EuNXPu3fGuZa94uTri6TJLD9KdHbH69MXAQDdxvw1");

function derivar(semillas: Buffer[]): Address {
  const [pda] = PublicKey.findProgramAddressSync(semillas, PROGRAM_ID);
  return address(pda.toBase58());
}

// seeds = [b"promotora", propietario.key().as_ref()]
export function pdaPromotora(propietario: Address) {
  return derivar([s.texto("promotora"), s.cuenta(propietario)]);
}

// seeds = [b"boxeador", promotora.key().as_ref(), &promotora.boxeador_counter.to_le_bytes()]
export function pdaBoxeador(promotora: Address, idBoxeador: number) {
  return derivar([s.texto("boxeador"), s.cuenta(promotora), s.u32(idBoxeador)]);
}

// seeds = [b"torneo", promotora.key().as_ref(), &promotora.torneo_counter.to_le_bytes()]
export function pdaTorneo(promotora: Address, idTorneo: number) {
  return derivar([s.texto("torneo"), s.cuenta(promotora), s.u32(idTorneo)]);
}

// seeds = [b"pelea", promotora.key().as_ref(), &promotora.pelea_counter.to_le_bytes()]
export function pdaPelea(promotora: Address, idPelea: number) {
  return derivar([s.texto("pelea"), s.cuenta(promotora), s.u32(idPelea)]);
}