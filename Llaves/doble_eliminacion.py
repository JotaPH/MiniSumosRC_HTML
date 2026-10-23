import math
import os
import random
import sys

BYE = 0            # lugar vacío: el rival pasa directo
PENDIENTE = None   # todavía no se sabe quién ocupará ese lugar


# ----------------------------------------------------------------------
# Utilidades de llenado
# ----------------------------------------------------------------------
def siguiente_potencia_de_dos(n):
    """Menor potencia de 2 que sea >= n."""
    return 2 ** math.ceil(math.log2(n))


def orden_extremos_centro(m):
    """Índices de extremos hacia el centro: m=4 -> [0, 3, 1, 2]."""
    orden, izq, der = [], 0, m - 1
    while izq <= der:
        orden.append(izq)
        if izq != der:
            orden.append(der)
        izq += 1
        der -= 1
    return orden


def primera_ronda(n):
    """Partidos de la primera ronda de ganadores (0 = bye)."""
    tamano = siguiente_potencia_de_dos(n)
    m = tamano // 2
    partidos = [[0, 0] for _ in range(m)]
    orden = orden_extremos_centro(m)
    jugadores = list(range(1, n + 1))

    for pos, partido in enumerate(orden):          # primer contrincante
        partidos[partido][0] = jugadores[pos]
    for pos, jugador in enumerate(jugadores[m:]):  # segundo contrincante
        partidos[orden[pos]][1] = jugador
    return tamano, partidos


# ----------------------------------------------------------------------
# Modelo del torneo
# ----------------------------------------------------------------------
class Partido:
    def __init__(self, codigo):
        self.codigo = codigo
        self.slots = [PENDIENTE, PENDIENTE]
        self.ganador = None
        self.perdedor = None
        self.hecho = False
        self.dest_ganador = None    # (partido, slot)
        self.dest_perdedor = None   # (partido, slot)


class Torneo:
    def __init__(self, n):
        self.n = n
        self.tamano, primera = primera_ronda(n)
        self.k = int(math.log2(self.tamano))
        self.campeon = None
        self.subcampeon = None

        self._crear_llaves()
        self._enlazar()
        self._armar_calendario()

        # Se llenan los jugadores; los byes se resuelven en cascada.
        for partido, (a, b) in zip(self.G[0], primera):
            self._colocar(partido, 0, a)
            self._colocar(partido, 1, b)

    # ---------- construcción ----------
    def _crear_llaves(self):
        t, k = self.tamano, self.k
        self.G = []
        for r in range(k):
            c = t // 2 ** (r + 1)
            self.G.append([Partido(f"G{r + 1}-{i + 1}") for i in range(c)])

        self.P = []
        for r in range(k - 1):
            c = t // 2 ** (r + 2)
            for _ in range(2):
                n_ronda = len(self.P) + 1
                self.P.append([Partido(f"P{n_ronda}-{i + 1}") for i in range(c)])

        self.final = Partido("FINAL")
        self.reset = Partido("RESET")

    def _enlazar(self):
        G, P, k = self.G, self.P, self.k

        # Ganadores avanzan en su llave
        for r in range(k):
            for i, p in enumerate(G[r]):
                if r < k - 1:
                    p.dest_ganador = (G[r + 1][i // 2], i % 2)
                else:
                    p.dest_ganador = (self.final, 0)

        # Perdedores de ganadores caen a la llave de perdedores
        if k == 1:
            G[0][0].dest_perdedor = (self.final, 1)
        else:
            for i, p in enumerate(G[0]):
                p.dest_perdedor = (P[0][i // 2], i % 2)
            for j in range(2, k + 1):                 # ronda j de ganadores
                ronda_p = P[2 * j - 3]
                m = len(G[j - 1])
                for i, p in enumerate(G[j - 1]):
                    # invertido para evitar revanchas inmediatas
                    p.dest_perdedor = (ronda_p[m - 1 - i], 1)

        # Avance dentro de la llave de perdedores
        for t, ronda in enumerate(P):
            for i, p in enumerate(ronda):
                if t == len(P) - 1:
                    p.dest_ganador = (self.final, 1)
                elif t % 2 == 0:                      # juegan contra perdedores de G
                    p.dest_ganador = (P[t + 1][i], 0)
                else:                                 # se enfrentan entre sí
                    p.dest_ganador = (P[t + 1][i // 2], i % 2)

    def _armar_calendario(self):
        """Orden de juego de las rondas (cada ronda va de extremos al centro)."""
        k, P = self.k, self.P
        seq = [("G", 0)]
        if k >= 2:
            seq.append(("P", 0))
            for j in range(2, k + 1):
                seq.append(("G", j - 1))
                seq.append(("P", 2 * j - 3))
                if 2 * j - 2 < len(P):
                    seq.append(("P", 2 * j - 2))

        self.calendario = []
        for tipo, idx in seq:
            self.calendario.append(self.G[idx] if tipo == "G" else self.P[idx])
        self.calendario.append([self.final])
        self.calendario.append([self.reset])

    # ---------- lógica ----------
    def _colocar(self, partido, slot, valor):
        partido.slots[slot] = valor
        self._auto(partido)

    def _auto(self, p):
        """Si el partido tiene un bye, el rival pasa directo."""
        if p.hecho or PENDIENTE in p.slots:
            return
        a, b = p.slots
        if a != BYE and b != BYE:
            return                      # partido real: hay que jugarlo
        ganador = b if a == BYE else a
        self._cerrar(p, ganador, BYE)

    def _cerrar(self, p, ganador, perdedor):
        p.ganador, p.perdedor, p.hecho = ganador, perdedor, True

        if p is self.final:
            if ganador == p.slots[0]:   # ganó el de la llave de ganadores
                self.reset.hecho = True
                self.reset.omitido = True
                self.reset.slots = list(p.slots)
                self.campeon, self.subcampeon = ganador, perdedor
            else:                       # ganó el de perdedores: segunda final
                self._colocar(self.reset, 0, p.slots[0])
                self._colocar(self.reset, 1, p.slots[1])
        elif p is self.reset:
            self.campeon, self.subcampeon = ganador, perdedor
        else:
            if p.dest_ganador:
                q, s = p.dest_ganador
                self._colocar(q, s, ganador)
            if p.dest_perdedor:
                q, s = p.dest_perdedor
                self._colocar(q, s, perdedor)

    def siguiente(self):
        """Próximo partido real por jugar (extremos -> centro)."""
        for ronda in self.calendario:
            for idx in orden_extremos_centro(len(ronda)):
                p = ronda[idx]
                if not p.hecho and PENDIENTE not in p.slots and BYE not in p.slots:
                    return p
        return None

    def jugar(self, p, slot_ganador):
        ganador = p.slots[slot_ganador]
        perdedor = p.slots[1 - slot_ganador]
        self._cerrar(p, ganador, perdedor)


# ----------------------------------------------------------------------
# Presentación
# ----------------------------------------------------------------------
def nombre_ronda(c):
    return {1: "Final", 2: "Semifinales", 4: "Cuartos de final",
            8: "Octavos de final"}.get(c, f"Ronda de {c * 2}")


def fmt(v):
    if v is PENDIENTE:
        return "—"
    return "0" if v == BYE else str(v)


def linea(p, siguiente):
    a, b = p.slots
    txt = f"  {p.codigo:<8} {fmt(a):>4}  vs  {fmt(b):<4}"
    if p.hecho:
        if p.ganador is None:
            txt += "   (no necesaria)"
        elif BYE in p.slots:
            txt += "   (pasa directo)" if p.ganador != BYE else "   (vacío)"
        else:
            txt += f"   → gana {p.ganador}"
    elif p is siguiente:
        txt += "   ◄ SIGUIENTE"
    return txt


def pantalla(t, sig, mensaje):
    if sys.stdout.isatty():
        os.system("cls" if os.name == "nt" else "clear")

    print(f"DOBLE ELIMINACIÓN · {t.n} participantes -> 2^{t.k} = {t.tamano}")
    print("(— = por definir, 0 = vacío/bye)\n")

    print("═══ LLAVE DE GANADORES ═══")
    for r, ronda in enumerate(t.G):
        print(f"\n G-R{r + 1} · {nombre_ronda(len(ronda))}")
        for p in ronda:
            print(linea(p, sig))

    if t.P:
        print("\n═══ LLAVE DE PERDEDORES ═══")
        for r, ronda in enumerate(t.P):
            print(f"\n P-R{r + 1} · {len(ronda)} partido(s)")
            for p in ronda:
                print(linea(p, sig))

    print("\n═══ GRAN FINAL ═══")
    print(linea(t.final, sig))
    print(linea(t.reset, sig))

    if mensaje:
        print(f"\n>> {mensaje}")
    if t.campeon is not None:
        print(f"\n🏆 CAMPEÓN: {t.campeon}   |   Subcampeón: {t.subcampeon}")


def leer_tecla():
    """Lee una sola tecla (sin Enter) si es posible."""
    if not sys.stdin.isatty():
        linea_txt = sys.stdin.readline()
        if linea_txt == "":
            raise EOFError
        return linea_txt[:1] or "\n"
    try:
        import msvcrt                       # Windows
        return msvcrt.getwch()
    except ImportError:
        import termios
        import tty                          # Linux / macOS
        fd = sys.stdin.fileno()
        viejo = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            return sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, viejo)


def main():
    while True:
        try:
            n = int(input("Ingrese la cantidad de participantes: "))
            if n >= 2:
                break
        except ValueError:
            pass
        print("Ingrese un número entero mayor o igual a 2.")

    t = Torneo(n)
    mensaje = "Llave generada. Los byes ya avanzaron automáticamente."

    try:
        while True:
            sig = t.siguiente()
            pantalla(t, sig, mensaje)
            if sig is None:
                break

            a, b = sig.slots
            print(f"\nPróximo: {sig.codigo} → {a} vs {b}")
            print("Teclas: [1] gana el primero | [2] gana el segundo | "
                  "[q] salir | otra tecla = azar")
            tecla = leer_tecla().lower()

            if tecla == "q" or tecla == "\x03":
                break
            slot = 0 if tecla == "1" else 1 if tecla == "2" else random.randint(0, 1)
            t.jugar(sig, slot)
            mensaje = f"{sig.codigo}: {a} vs {b} → gana {sig.ganador}"
    except (KeyboardInterrupt, EOFError):
        print()


if __name__ == "__main__":
    main()
