import type { Address } from "@solana/kit";
import {
  Categoria,
  Resultado,
  fetchMaybePromotora,
  fetchAllMaybeBoxeador,
  fetchAllMaybeTorneo,
  fetchAllMaybePelea,
} from "../../clients/js/src/generated";
import { rpc } from "./conexion";
import { pdaPromotora, pdaBoxeador, pdaTorneo, pdaPelea } from "./pdas";

export type BoxeadorUI = {
  direccion: Address;
  idBoxeador: number;
  nombre: string;
  peso: number;
  categoria: Categoria;
  victorias: number;
  derrotas: number;
  empates: number;
  activo: boolean;
  peleasRegistradas: number;
};

export type TorneoUI = {
  direccion: Address;
  idTorneo: number;
  nombre: string;
  sede: string;
  categoria: Categoria;
  activo: boolean;
};

export type PeleaUI = {
  direccion: Address;
  idPelea: number;
  boxeadorRojo: Address;
  boxeadorAzul: Address;
  torneo: Address;
  resultado: Resultado;
};

export type PromotoraUI = {
  direccion: Address;
  propietario: Address;
  boxeadorCounter: number;
  torneoCounter: number;
  peleaCounter: number;
  boxeadores: BoxeadorUI[];
  torneos: TorneoUI[];
  peleas: PeleaUI[];
};

export async function leerPromotora(propietario: Address): Promise<PromotoraUI | null> {
  const direccion = pdaPromotora(propietario);
  const cuenta = await fetchMaybePromotora(rpc, direccion);

  if (!cuenta.exists) return null;

  const { boxeadorCounter, torneoCounter, peleaCounter } = cuenta.data;

  const pdasBoxeadores = Array.from({ length: boxeadorCounter }, (_, i) => pdaBoxeador(direccion, i));
  const pdasTorneos = Array.from({ length: torneoCounter }, (_, i) => pdaTorneo(direccion, i));
  const pdasPeleas = Array.from({ length: peleaCounter }, (_, i) => pdaPelea(direccion, i));

  const [resBoxeadores, resTorneos, resPeleas] = await Promise.all([
    pdasBoxeadores.length ? fetchAllMaybeBoxeador(rpc, pdasBoxeadores) : Promise.resolve([]),
    pdasTorneos.length ? fetchAllMaybeTorneo(rpc, pdasTorneos) : Promise.resolve([]),
    pdasPeleas.length ? fetchAllMaybePelea(rpc, pdasPeleas) : Promise.resolve([]),
  ]);

  return {
    direccion,
    propietario: cuenta.data.propietario,
    boxeadorCounter,
    torneoCounter,
    peleaCounter,
    boxeadores: resBoxeadores
      .filter((b) => b.exists)
      .map((b) => ({
        direccion: b.address,
        idBoxeador: b.data.idBoxeador,
        nombre: b.data.nombre,
        peso: Number(b.data.peso),
        categoria: b.data.categoria,
        victorias: b.data.victorias,
        derrotas: b.data.derrotas,
        empates: b.data.empates,
        activo: b.data.activo,
        peleasRegistradas: b.data.peleasRegistradas,
      })),
    torneos: resTorneos
      .filter((t) => t.exists)
      .map((t) => ({
        direccion: t.address,
        idTorneo: t.data.idTorneo,
        nombre: t.data.nombre,
        sede: t.data.sede,
        categoria: t.data.categoria,
        activo: t.data.activo,
      })),
    peleas: resPeleas
      .filter((p) => p.exists)
      .map((p) => ({
        direccion: p.address,
        idPelea: p.data.idPelea,
        boxeadorRojo: p.data.boxeadorRojo,
        boxeadorAzul: p.data.boxeadorAzul,
        torneo: p.data.torneo,
        resultado: p.data.resultado,
      })),
  };
}