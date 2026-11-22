import { useEffect, useRef, useState } from 'react';
import { address } from '@solana/kit';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import programa from '../config/programa.json';
import { Categoria, Resultado } from '../../clients/js/src/generated';
import { leerPromotora, type PromotoraUI } from '../solana/lecturas';
import { ErrorTransaccion, ErrorConfirmacionPendiente, enlaceTransaccion, traducir, type OpcionesEnvio } from '../solana/tx';
import {
  inicializarPromotora,
  registrarBoxeador,
  eliminarBoxeador,
  crearTorneo,
  registrarPelea,
  eliminarPelea,
} from '../solana/acciones';

type Operacion = 'promotora' | 'boxeador' | 'torneo' | 'pelea';
const operaciones: { id: Operacion; texto: string }[] = [
  { id: 'promotora', texto: 'Inicializar promotora' },
  { id: 'boxeador', texto: 'Registrar boxeador' },
  { id: 'torneo', texto: 'Crear torneo' },
  { id: 'pelea', texto: 'Registrar pelea' },
];

const CATEGORIAS: { valor: Categoria; etiqueta: string }[] = [
  { valor: Categoria.Minimosca, etiqueta: 'Minimosca' },
  { valor: Categoria.Mosca, etiqueta: 'Mosca' },
  { valor: Categoria.Gallo, etiqueta: 'Gallo' },
  { valor: Categoria.Pluma, etiqueta: 'Pluma' },
  { valor: Categoria.Ligero, etiqueta: 'Ligero' },
  { valor: Categoria.Superligero, etiqueta: 'Superligero' },
  { valor: Categoria.Welter, etiqueta: 'Welter' },
  { valor: Categoria.Superwelter, etiqueta: 'Superwelter' },
  { valor: Categoria.Mediano, etiqueta: 'Mediano' },
  { valor: Categoria.Pesado, etiqueta: 'Pesado' },
];

function nombreCategoria(cat: Categoria): string {
  return CATEGORIAS.find((c) => c.valor === cat)?.etiqueta ?? 'N/A';
}

function textoResultado(res: Resultado): string {
  switch (res) {
    case Resultado.RojoGana: return 'Gana Rojo';
    case Resultado.AzulGana: return 'Gana Azul';
    case Resultado.Empate: return 'Empate';
    default: return 'Pendiente';
  }
}

export function Registro({ onCambio, onOcupado }: { onCambio: () => void; onOcupado: (valor: boolean) => void }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletDireccion = wallet.publicKey?.toBase58() ?? '';

  const [autoridad, setAutoridad] = useState(walletDireccion);
  const [promotora, setPromotora] = useState<PromotoraUI | null>(null);
  const [consultado, setConsultado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState('');

  const [op, setOp] = useState<Operacion>('promotora');
  const [nombreBoxeador, setNombreBoxeador] = useState('Saúl Álvarez');
  const [peso, setPeso] = useState('76');
  const [categoriaBoxeador, setCategoriaBoxeador] = useState<Categoria>(Categoria.Mediano);

  const [nombreTorneo, setNombreTorneo] = useState('Torneo Nacional 2026');
  const [sede, setSede] = useState('Arena México');
  const [categoriaTorneo, setCategoriaTorneo] = useState<Categoria>(Categoria.Mediano);

  const [idTorneoPelea, setIdTorneoPelea] = useState('0');
  const [idBoxeadorRojo, setIdBoxeadorRojo] = useState('0');
  const [idBoxeadorAzul, setIdBoxeadorAzul] = useState('1');

  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaFallida, setFirmaFallida] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [aviso, setAviso] = useState('');

  const contexto = useRef('');
  const secuencia = useRef(0);
  contexto.current = autoridad;

  useEffect(() => {
    setAutoridad(walletDireccion);
  }, [walletDireccion]);

  useEffect(() => {
    secuencia.current += 1;
    setPromotora(null);
    setConsultado(false);
    setErrorLectura('');
    setLeyendo(false);
    setFirma('');
    setFirmaFallida('');
    setErrorOperacion('');
    setAviso('');
    if (autoridad.trim()) {
      void cargar(autoridad.trim()).catch(() => {});
    }
  }, [autoridad]);

  useEffect(() => {
    onOcupado(ocupado);
    return () => onOcupado(false);
  }, [ocupado, onOcupado]);

  async function cargar(owner = autoridad) {
    const clave = owner.trim();
    if (!clave) return;
    const turno = ++secuencia.current;
    setLeyendo(true);
    setErrorLectura('');
    try {
      const datos = await leerPromotora(address(clave));
      if (turno === secuencia.current && contexto.current.trim() === clave) {
        setPromotora(datos);
        setConsultado(true);
        if (datos && op === 'promotora') {
          setOp('boxeador');
        }
      }
    } catch (error) {
      if (turno === secuencia.current) setErrorLectura(traducir(error));
      throw error;
    } finally {
      if (turno === secuencia.current) setLeyendo(false);
    }
  }

  async function ejecutarTransaccion(accion: (opciones: OpcionesEnvio) => Promise<string>) {
    setOcupado(true);
    setFase('Preparando operación…');
    setFirma('');
    setFirmaFallida('');
    setErrorOperacion('');
    setAviso('');
    const direccionWallet = walletDireccion;
    const opciones: OpcionesEnvio = {
      onEstado: (estado) =>
        setFase(estado === 'firma' ? 'Revisa la solicitud en tu wallet…' : 'Esperando confirmación de la red…'),
    };
    try {
      const resultado = await accion(opciones);
      setFirma(resultado);
      setFase('Operación confirmada correctamente.');
      onCambio();
      try {
        await cargar(direccionWallet);
      } catch {
        setAviso('La operación se confirmó, pero no pudimos actualizar los datos. Pulsa Consultar promotora.');
      }
    } catch (error) {
      setFase('');
      setErrorOperacion(traducir(error));
      if (error instanceof ErrorTransaccion || error instanceof ErrorConfirmacionPendiente) {
        setFirmaFallida(error.firma);
      }
    } finally {
      setOcupado(false);
    }
  }

  async function ejecutarFormulario(evento: React.FormEvent) {
    evento.preventDefault();
    await ejecutarTransaccion(async (opciones) => {
      switch (op) {
        case 'promotora':
          return inicializarPromotora(wallet, connection, opciones);
        case 'boxeador':
          return registrarBoxeador(wallet, connection, nombreBoxeador, Number(peso), categoriaBoxeador, opciones);
        case 'torneo':
          return crearTorneo(wallet, connection, nombreTorneo, sede, categoriaTorneo, opciones);
        case 'pelea':
          return registrarPelea(wallet, connection, Number(idTorneoPelea), Number(idBoxeadorRojo), Number(idBoxeadorAzul), opciones);
      }
    });
  }

  const esOtraAutoridad = !!autoridad.trim() && autoridad.trim() !== walletDireccion;
  const permiteEscribir = !programa.esReferencia && !!wallet.publicKey && !esOtraAutoridad;

  const nombreBoxeadorPorDireccion = (dir: string) =>
    promotora?.boxeadores.find((b) => b.direccion === dir)?.nombre ?? dir.slice(0, 6) + '…';

  const nombreTorneoPorDireccion = (dir: string) =>
    promotora?.torneos.find((t) => t.direccion === dir)?.nombre ?? dir.slice(0, 6) + '…';

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">PROMOTORA · BOXEADORES · TORNEOS · PELEAS</p>
          <h2>Sistema Boxchain</h2>
        </div>
        <span className="tag">Torneos de Boxeo On-Chain</span>
      </div>

      {programa.esReferencia && (
        <aside className="notice information">
          <strong>Configura tu programa para comenzar.</strong>
          <p>Importa el IDL exportado de tu despliegue para consultar la promotora y realizar operaciones.</p>
        </aside>
      )}

      <section className="panel lookup-panel">
        <div className="panel-heading">
          <h3>Localizar promotora</h3>
          <span className="small-note">Lectura sin firma</span>
        </div>
        <div className="lookup-fields">
          <label>
            Dirección de la autoridad (Propietario)
            <input
              value={autoridad}
              disabled={ocupado}
              onChange={(e) => setAutoridad(e.target.value)}
              placeholder="Conecta tu wallet o pega una dirección pública"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button
            className="button secondary"
            disabled={leyendo || ocupado || programa.esReferencia || !autoridad.trim()}
            onClick={() => void cargar().catch(() => {})}
          >
            {leyendo ? 'Consultando…' : 'Consultar promotora'}
          </button>
        </div>
        <p className="help">
          Cada wallet administra su propia promotora derivada por PDA. Puedes pegar otra wallet para ver su cartelera en modo lectura.
        </p>
        {errorLectura && (
          <p className="notice error" role="alert">
            {errorLectura}
          </p>
        )}
      </section>

      <div className="workspace-grid">
        <section className="panel customers-panel">
          <div className="panel-heading">
            <h3>Cartelera y registros</h3>
            {promotora && (
              <span className="count">
                {promotora.boxeadores.length} boxeadores · {promotora.torneos.length} torneos · {promotora.peleas.length} peleas
              </span>
            )}
          </div>

          {!promotora ? (
            <div className="empty-state">
              <span className="empty-symbol">🥊</span>
              <h4>{consultado ? 'La promotora todavía no existe' : 'Tu promotora aparecerá aquí'}</h4>
              <p>
                {consultado
                  ? 'Inicializa tu promotora desde Operaciones con tu wallet conectada para comenzar a registrar boxeadores, torneos y peleas.'
                  : 'Conecta tu wallet o consulta una dirección para cargar sus datos on-chain.'}
              </p>
            </div>
          ) : (
            <>
              <div className="registry-summary">
                <div>
                  <span className="label">Boxeadores creados</span>
                  <strong>{promotora.boxeadorCounter}</strong>
                </div>
                <div>
                  <span className="label">Torneos creados</span>
                  <strong>{promotora.torneoCounter}</strong>
                </div>
                <div>
                  <span className="label">Peleas creadas</span>
                  <strong>{promotora.peleaCounter}</strong>
                </div>
              </div>

              <details className="technical-details">
                <summary>Dirección PDA de la promotora</summary>
                <code className="address">{promotora.direccion}</code>
              </details>

              {/* BOXEADORES */}
              <article className="customer">
                <header>
                  <div>
                    <strong>Boxeadores registrados ({promotora.boxeadores.length})</strong>
                  </div>
                </header>
                {promotora.boxeadores.length === 0 ? (
                  <p className="empty-line">Todavía no hay boxeadores activos.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Categoría</th>
                          <th className="numeric">Peso</th>
                          <th className="numeric">Peleas</th>
                          {permiteEscribir && <th>Acción</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {promotora.boxeadores.map((b) => (
                          <tr key={b.direccion}>
                            <td><code>#{b.idBoxeador}</code></td>
                            <td><strong>{b.nombre}</strong></td>
                            <td>{nombreCategoria(b.categoria)}</td>
                            <td className="numeric">{b.peso} kg</td>
                            <td className="numeric">{b.peleasRegistradas}</td>
                            {permiteEscribir && (
                              <td>
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={ocupado || b.peleasRegistradas > 0}
                                  title={b.peleasRegistradas > 0 ? 'No se puede eliminar porque tiene peleas registradas' : 'Eliminar boxeador'}
                                  onClick={() =>
                                    void ejecutarTransaccion((ops) => eliminarBoxeador(wallet, connection, b.idBoxeador, ops))
                                  }
                                >
                                  {b.peleasRegistradas > 0 ? 'Con peleas' : 'Eliminar'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              {/* TORNEOS */}
              <article className="customer">
                <header>
                  <div>
                    <strong>Torneos ({promotora.torneos.length})</strong>
                  </div>
                </header>
                {promotora.torneos.length === 0 ? (
                  <p className="empty-line">Todavía no hay torneos creados.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Torneo</th>
                          <th>Sede</th>
                          <th>Categoría</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotora.torneos.map((t) => (
                          <tr key={t.direccion}>
                            <td><code>#{t.idTorneo}</code></td>
                            <td><strong>{t.nombre}</strong></td>
                            <td>{t.sede}</td>
                            <td>{nombreCategoria(t.categoria)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              {/* PELEAS */}
              <article className="customer">
                <header>
                  <div>
                    <strong>Peleas programadas ({promotora.peleas.length})</strong>
                  </div>
                </header>
                {promotora.peleas.length === 0 ? (
                  <p className="empty-line">Todavía no hay peleas registradas.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Torneo</th>
                          <th>Esquina Roja vs Azul</th>
                          <th>Estado</th>
                          {permiteEscribir && <th>Acción</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {promotora.peleas.map((p) => (
                          <tr key={p.direccion}>
                            <td><code>#{p.idPelea}</code></td>
                            <td>{nombreTorneoPorDireccion(p.torneo)}</td>
                            <td>
                              <strong>{nombreBoxeadorPorDireccion(p.boxeadorRojo)}</strong> vs{' '}
                              <strong>{nombreBoxeadorPorDireccion(p.boxeadorAzul)}</strong>
                            </td>
                            <td>{textoResultado(p.resultado)}</td>
                            {permiteEscribir && (
                              <td>
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={ocupado}
                                  onClick={() =>
                                    void ejecutarTransaccion((ops) =>
                                      eliminarPelea(wallet, connection, p.idPelea, p.boxeadorRojo, p.boxeadorAzul, ops)
                                    )
                                  }
                                >
                                  Eliminar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </>
          )}
        </section>

        <section className="panel operations-panel">
          <div className="panel-heading">
            <h3>Operaciones</h3>
            <span className="small-note">Con firma</span>
          </div>

          <div className="operation-tabs">
            {operaciones.map((item) => (
              <button
                key={item.id}
                type="button"
                className={op === item.id ? 'active' : ''}
                disabled={ocupado}
                onClick={() => {
                  setOp(item.id);
                  setFirma('');
                  setErrorOperacion('');
                  setFirmaFallida('');
                  setFase('');
                }}
              >
                {item.texto}
              </button>
            ))}
          </div>

          <form onSubmit={ejecutarFormulario}>
            <fieldset disabled={ocupado || !permiteEscribir}>
              {op === 'promotora' && (
                <p className="help">
                  Inicializará la cuenta central <strong>Promotora</strong> vinculada a tu wallet conectada para llevar los contadores de boxeadores, torneos y peleas.
                </p>
              )}

              {op === 'boxeador' && (
                <>
                  <label>
                    Nombre del boxeador
                    <input value={nombreBoxeador} onChange={(e) => setNombreBoxeador(e.target.value)} maxLength={50} required />
                  </label>
                  <div className="two-fields">
                    <label>
                      Peso (kg)
                      <input type="number" min="1" step="1" value={peso} onChange={(e) => setPeso(e.target.value)} required />
                    </label>
                    <label>
                      Categoría
                      <select
                        value={categoriaBoxeador}
                        onChange={(e) => setCategoriaBoxeador(Number(e.target.value) as Categoria)}
                      >
                        {CATEGORIAS.map((cat) => (
                          <option key={cat.valor} value={cat.valor}>
                            {cat.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}

              {op === 'torneo' && (
                <>
                  <label>
                    Nombre del torneo
                    <input value={nombreTorneo} onChange={(e) => setNombreTorneo(e.target.value)} maxLength={50} required />
                  </label>
                  <div className="two-fields">
                    <label>
                      Sede
                      <input value={sede} onChange={(e) => setSede(e.target.value)} maxLength={50} required />
                    </label>
                    <label>
                      Categoría
                      <select
                        value={categoriaTorneo}
                        onChange={(e) => setCategoriaTorneo(Number(e.target.value) as Categoria)}
                      >
                        {CATEGORIAS.map((cat) => (
                          <option key={cat.valor} value={cat.valor}>
                            {cat.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}

              {op === 'pelea' && (
                <>
                  <label>
                    ID del Torneo
                    {promotora && promotora.torneos.length > 0 ? (
                      <select value={idTorneoPelea} onChange={(e) => setIdTorneoPelea(e.target.value)}>
                        {promotora.torneos.map((t) => (
                          <option key={t.idTorneo} value={t.idTorneo}>
                            #{t.idTorneo} - {t.nombre} ({t.sede})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input type="number" min="0" step="1" value={idTorneoPelea} onChange={(e) => setIdTorneoPelea(e.target.value)} required />
                    )}
                  </label>
                  <div className="two-fields">
                    <label>
                      Esquina Roja (Boxeador)
                      {promotora && promotora.boxeadores.length > 0 ? (
                        <select value={idBoxeadorRojo} onChange={(e) => setIdBoxeadorRojo(e.target.value)}>
                          {promotora.boxeadores.map((b) => (
                            <option key={b.idBoxeador} value={b.idBoxeador}>
                              #{b.idBoxeador} - {b.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="number" min="0" step="1" value={idBoxeadorRojo} onChange={(e) => setIdBoxeadorRojo(e.target.value)} required />
                      )}
                    </label>
                    <label>
                      Esquina Azul (Boxeador)
                      {promotora && promotora.boxeadores.length > 0 ? (
                        <select value={idBoxeadorAzul} onChange={(e) => setIdBoxeadorAzul(e.target.value)}>
                          {promotora.boxeadores.map((b) => (
                            <option key={b.idBoxeador} value={b.idBoxeador}>
                              #{b.idBoxeador} - {b.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="number" min="0" step="1" value={idBoxeadorAzul} onChange={(e) => setIdBoxeadorAzul(e.target.value)} required />
                      )}
                    </label>
                  </div>
                </>
              )}

              <button className="button primary" type="submit">
                {ocupado ? 'Operación en curso…' : operaciones.find((item) => item.id === op)!.texto}
              </button>
            </fieldset>
          </form>

          {!wallet.publicKey && <p className="help">Conecta tu wallet en Devnet para realizar operaciones.</p>}
          {esOtraAutoridad && wallet.publicKey && (
            <p className="notice subtle">Estás consultando otra autoridad. Para escribir, usa la dirección de tu wallet conectada.</p>
          )}
          {ocupado && (
            <p className="notice information" role="status">
              {fase}
            </p>
          )}
          {firma && (
            <p className="notice success" role="status">
              <strong>Operación confirmada.</strong>
              <br />
              <a href={enlaceTransaccion(firma)} target="_blank" rel="noreferrer">
                Ver transacción en Explorer
              </a>
            </p>
          )}
          {errorOperacion && (
            <p className="notice error" role="alert">
              {errorOperacion}
              {firmaFallida && (
                <>
                  <br />
                  <a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">
                    Revisar transacción en Explorer
                  </a>
                </>
              )}
            </p>
          )}
          {aviso && <p className="notice subtle">{aviso}</p>}
        </section>
      </div>
    </>
  );
}