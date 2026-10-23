"""Interfaz gráfica (tkinter) para la doble eliminación.

Requiere estar en la misma carpeta que doble_eliminacion.py
Ejecutar:  python doble_eliminacion_gui.py
"""
import random
import tkinter as tk

from doble_eliminacion import BYE, PENDIENTE, Torneo, nombre_ronda

# ---- medidas ----
BW, BH = 124, 40          # ancho / alto de cada caja de partido
VG = 16                   # separación vertical entre cajas
COLW = 176                # distancia entre columnas (rondas)
MX, MY = 64, 70           # márgenes

# ---- colores ----
BG = "#0f172a"
CAJA = "#1e293b"
VACIA = "#111827"
GANA = "#166534"
PIERDE = "#3f1d1d"
LINEA = "#475569"
LINEA_OK = "#22c55e"
SIGUIENTE = "#f59e0b"
TEXTO = "#e2e8f0"
TENUE = "#64748b"

TECLAS_IGNORADAS = {"", "\x1b"}


class App:
    def __init__(self, root):
        self.root = root
        root.title("Doble eliminación")
        root.configure(bg=BG)
        root.geometry("1250x760")

        self.t = None
        self.pos = {}
        self.W = self.H = 1
        self.auto = False
        self.msg = ""

        self._crear_ui()
        self.generar()

    # ------------------------------------------------------------------
    # Interfaz
    # ------------------------------------------------------------------
    def _crear_ui(self):
        barra = tk.Frame(self.root, bg=BG)
        barra.pack(fill="x", padx=10, pady=8)

        tk.Label(barra, text="Participantes:", bg=BG, fg=TEXTO).pack(side="left")
        self.spin = tk.Spinbox(barra, from_=2, to=64, width=5)
        self.spin.delete(0, "end")
        self.spin.insert(0, "5")
        self.spin.pack(side="left", padx=(4, 8))

        def boton(texto, cmd, color="#334155"):
            b = tk.Button(barra, text=texto, command=cmd, bg=color, fg="white",
                          activebackground=color, relief="flat", padx=10,
                          pady=3, takefocus=0)
            b.pack(side="left", padx=3)
            return b

        boton("Generar llave", self.generar, "#2563eb")
        boton("▶ Siguiente (azar)", lambda: self.jugar(None), "#16a34a")
        boton("▲ Gana arriba", lambda: self.jugar(0))
        boton("▼ Gana abajo", lambda: self.jugar(1))
        self.btn_auto = boton("⏩ Auto", self.alternar_auto)

        tk.Label(barra, text="Cualquier tecla = siguiente · 1 / 2 = elegir ganador",
                 bg=BG, fg=TENUE).pack(side="right")

        marco = tk.Frame(self.root, bg=BG)
        marco.pack(fill="both", expand=True, padx=10)
        self.cv = tk.Canvas(marco, bg=BG, highlightthickness=0)
        sx = tk.Scrollbar(marco, orient="horizontal", command=self.cv.xview)
        sy = tk.Scrollbar(marco, orient="vertical", command=self.cv.yview)
        self.cv.configure(xscrollcommand=sx.set, yscrollcommand=sy.set)
        sx.pack(side="bottom", fill="x")
        sy.pack(side="right", fill="y")
        self.cv.pack(side="left", fill="both", expand=True)

        self.estado = tk.Label(self.root, text="", bg="#020617", fg=TEXTO,
                               anchor="w", padx=10, pady=6,
                               font=("Helvetica", 11))
        self.estado.pack(fill="x", side="bottom")

        # Teclado y rueda del ratón
        self.root.bind("<Key>", self._tecla)
        self.cv.bind("<Button-1>", lambda e: self.cv.focus_set())
        self.cv.bind("<MouseWheel>",
                     lambda e: self.cv.yview_scroll(-1 if e.delta > 0 else 1, "units"))
        self.cv.bind("<Shift-MouseWheel>",
                     lambda e: self.cv.xview_scroll(-1 if e.delta > 0 else 1, "units"))
        self.cv.bind("<Button-4>", lambda e: self.cv.yview_scroll(-1, "units"))
        self.cv.bind("<Button-5>", lambda e: self.cv.yview_scroll(1, "units"))

    def _tecla(self, e):
        if isinstance(e.widget, tk.Spinbox):
            return
        if e.char in TECLAS_IGNORADAS:
            return
        self.jugar(0 if e.char == "1" else 1 if e.char == "2" else None)

    # ------------------------------------------------------------------
    # Acciones
    # ------------------------------------------------------------------
    def generar(self):
        try:
            n = int(self.spin.get())
        except ValueError:
            n = 0
        if not 2 <= n <= 64:
            self.estado.config(text="Ingresa un número entre 2 y 64.")
            return
        self.auto = False
        self.btn_auto.config(text="⏩ Auto")
        self.t = Torneo(n)
        self._calcular_posiciones()
        self.msg = "Llave generada. Los byes ya avanzaron automáticamente."
        self.dibujar()
        self.cv.focus_set()

    def jugar(self, slot):
        sig = self.t.siguiente()
        if sig is None:
            return
        if slot is None:
            slot = random.randint(0, 1)
        a, b = sig.slots
        self.t.jugar(sig, slot)
        self.msg = f"{sig.codigo}: {a} vs {b} → gana {sig.ganador}"
        self.dibujar()

    def alternar_auto(self):
        self.auto = not self.auto
        self.btn_auto.config(text="⏸ Pausa" if self.auto else "⏩ Auto")
        if self.auto:
            self._paso_auto()

    def _paso_auto(self):
        if not self.auto:
            return
        if self.t.siguiente() is None:
            self.auto = False
            self.btn_auto.config(text="⏩ Auto")
            return
        self.jugar(None)
        self.root.after(600, self._paso_auto)

    # ------------------------------------------------------------------
    # Posiciones (estructura clásica de llaves)
    # ------------------------------------------------------------------
    def _calcular_posiciones(self):
        t = self.t
        G, P = t.G, t.P
        paso = BH + VG
        pos = {}

        # Ganadores: cada partido queda centrado entre sus dos alimentadores
        for r, ronda in enumerate(G):
            for i, p in enumerate(ronda):
                if r == 0:
                    yc = MY + i * paso + BH / 2
                else:
                    yc = (pos[G[r - 1][2 * i]][1] + pos[G[r - 1][2 * i + 1]][1]) / 2
                pos[p] = (MX + r * COLW, yc)

        # Perdedores: rondas impares = 1 a 1 (mismo y), pares = se fusionan de a dos
        self.lb_top = MY + len(G[0]) * paso + 60
        for tt, ronda in enumerate(P):
            for i, p in enumerate(ronda):
                if tt == 0:
                    yc = self.lb_top + i * paso + BH / 2
                elif tt % 2 == 1:
                    yc = pos[P[tt - 1][i]][1]
                else:
                    yc = (pos[P[tt - 1][2 * i]][1] + pos[P[tt - 1][2 * i + 1]][1]) / 2
                pos[p] = (MX + tt * COLW, yc)

        # Gran final
        col = max(t.k, len(P))
        yg = pos[G[-1][0]][1]
        yf = (yg + pos[P[-1][0]][1]) / 2 if P else yg
        pos[t.final] = (MX + col * COLW, yf)
        pos[t.reset] = (MX + col * COLW, yf + BH + 60)

        self.pos = pos
        self.W = MX * 2 + (col + 1) * COLW
        self.H = max(y for _, y in pos.values()) + BH + 80

    # ------------------------------------------------------------------
    # Dibujo
    # ------------------------------------------------------------------
    def dibujar(self):
        t, cv = self.t, self.cv
        sig = t.siguiente()
        cv.delete("all")
        cv.configure(scrollregion=(0, 0, self.W, self.H))

        todos = [p for r in t.G for p in r] + [p for r in t.P for p in r]

        # títulos de sección y de ronda
        cv.create_text(MX, 14, anchor="w", text="LLAVE DE GANADORES",
                       fill=TEXTO, font=("Helvetica", 12, "bold"))
        for r, ronda in enumerate(t.G):
            cv.create_text(MX + r * COLW, MY - 24, anchor="w",
                           text=f"G-R{r + 1} · {nombre_ronda(len(ronda))}",
                           fill=TENUE, font=("Helvetica", 9))
        if t.P:
            cv.create_text(MX, self.lb_top - 52, anchor="w",
                           text="LLAVE DE PERDEDORES", fill=TEXTO,
                           font=("Helvetica", 12, "bold"))
            for tt, ronda in enumerate(t.P):
                cv.create_text(MX + tt * COLW, self.lb_top - 24, anchor="w",
                               text=f"P-R{tt + 1} · {len(ronda)} partido(s)",
                               fill=TENUE, font=("Helvetica", 9))
        fx = self.pos[t.final][0]
        cv.create_text(fx, self.pos[t.final][1] - BH / 2 - 26, anchor="w",
                       text="GRAN FINAL", fill=TEXTO, font=("Helvetica", 12, "bold"))

        # conectores (debajo de las cajas)
        for p in todos:
            self._conector(p, p.dest_ganador)
        if t.k == 1:
            self._conector(t.G[0][0], t.G[0][0].dest_perdedor)

        # etiquetas de "viene de ganadores" en la llave de perdedores
        if t.k >= 2:
            for p in (p for r in t.G for p in r):
                q, s = p.dest_perdedor
                qx, qy = self.pos[q]
                y = qy + (-BH / 4 if s == 0 else BH / 4)
                cv.create_text(qx - 5, y, anchor="e", text=f"↓{p.codigo}",
                               fill="#f87171", font=("Helvetica", 7))

        # cajas
        for p in todos + [t.final, t.reset]:
            self._caja(p, sig)

        if t.campeon is not None:
            x, y = self.pos[t.reset]
            cv.create_text(x, y + BH / 2 + 30, anchor="w",
                           text=f"🏆 Campeón: {t.campeon}", fill=SIGUIENTE,
                           font=("Helvetica", 14, "bold"))

        self._actualizar_estado(sig)
        if sig is not None:
            self._centrar(*self.pos[sig])

    def _conector(self, p, destino):
        if destino is None:
            return
        q, s = destino
        x1, y1 = self.pos[p][0] + BW, self.pos[p][1]
        x2, y2 = self.pos[q][0], self.pos[q][1] + (-BH / 4 if s == 0 else BH / 4)
        xm = (x1 + x2) / 2
        usado = p.hecho and p.ganador not in (None, BYE)
        self.cv.create_line(x1, y1, xm, y1, xm, y2, x2, y2,
                            fill=LINEA_OK if usado else LINEA, width=2 if usado else 1)

    def _caja(self, p, sig):
        cv = self.cv
        x, yc = self.pos[p]
        y = yc - BH / 2
        es_sig = p is sig

        cv.create_text(x, y - 3, anchor="sw", text=p.codigo,
                       fill=SIGUIENTE if es_sig else TENUE, font=("Helvetica", 7))

        for s in range(2):
            v = p.slots[s]
            ry = y + s * BH / 2
            if v is PENDIENTE:
                fondo, color, texto = CAJA, TENUE, "—"
            elif v == BYE:
                fondo, color, texto = VACIA, "#374151", "BYE"
            else:
                fondo, color, texto = CAJA, TEXTO, f"Jugador {v}"
                if p.hecho and p.ganador is not None:
                    if v == p.ganador:
                        fondo = GANA
                    elif v == p.perdedor:
                        fondo, color = PIERDE, "#9ca3af"

            r = cv.create_rectangle(x, ry, x + BW, ry + BH / 2, fill=fondo,
                                    outline=LINEA, width=1)
            cv.create_text(x + 8, ry + BH / 4, anchor="w", text=texto,
                           fill=color, font=("Helvetica", 9, "bold"))
            if es_sig:   # clic en un jugador = lo declara ganador
                cv.tag_bind(r, "<Button-1>", lambda e, s=s: self.jugar(s))

        cv.create_rectangle(x, y, x + BW, y + BH, fill="",
                            outline=SIGUIENTE if es_sig else LINEA,
                            width=3 if es_sig else 1)

    def _actualizar_estado(self, sig):
        t = self.t
        if t.campeon is not None:
            txt = f"🏆 Campeón: {t.campeon}   ·   Subcampeón: {t.subcampeon}   ·   {self.msg}"
        elif sig is not None:
            a, b = sig.slots
            txt = f"Siguiente: {sig.codigo} → {a} vs {b}   ·   {self.msg}"
        else:
            txt = self.msg
        self.estado.config(text=txt)

    def _centrar(self, x, y):
        self.root.update_idletasks()
        cw, ch = self.cv.winfo_width(), self.cv.winfo_height()
        self.cv.xview_moveto(max(0, (x + BW / 2 - cw / 2) / self.W))
        self.cv.yview_moveto(max(0, (y - ch / 2) / self.H))


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
