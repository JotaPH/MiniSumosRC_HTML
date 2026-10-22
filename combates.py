
combates_totales = 0


# =========================================================
# FUNCIONES GENERALES
# =========================================================

def calcular_llave(n):
    capacidad = 1
    while capacidad < n:
        capacidad *= 2

    byes = capacidad - n
    combates = (n - byes) // 2
    rondas = capacidad.bit_length() - 1

    return rondas, byes, combates


def participante(nombre, ha_combatido=False, estado_lossers="pendiente"):
    return {
        "id": nombre,
        "nombre": nombre,
        "ha_combatido": ha_combatido,
        # En Lossers: pendiente = debe superar la ronda actual;
        # listo = ya superó la ronda previa y espera a un caído de Winners;
        # caido = acaba de llegar desde Winners.
        "estado_lossers": estado_lossers
    }


def resultado(numero, estado_lossers="pendiente"):
    return participante(f"#{numero}", True, estado_lossers)


def mostrar(tabla, titulo):
    print("\n" + "=" * 55)
    print(titulo)
    print("-" * 55)
    print("  |  ".join(p["nombre"] for p in tabla) or "Vacío")
    print("=" * 55)


def mostrar_todo(winners, lossers):
    mostrar(winners, "WINNERS")
    mostrar(lossers, "LOSSERS")
    print(f"Combates acumulados: {combates_totales}")


def avanzar():
    while True:
        comando = input("\n's' = avanzar | 'q' = salir: ").strip().lower()

        if comando == "s":
            return True
        if comando == "q":
            return False

        print("Comando no válido.")


def buscar(tabla, ident):
    for i, p in enumerate(tabla):
        if p["id"] == ident:
            return i

    raise ValueError(f"No se encontró {ident}")


def quitar_y_reemplazar(tabla, a, b, nuevo, conservar):
    ia = buscar(tabla, a["id"])
    ib = buscar(tabla, b["id"])

    # Recalcular las posiciones según la tabla actual.
    conservar_id = conservar["id"]
    ic = buscar(tabla, conservar_id)
    ie = ib if ic == ia else ia

    tabla[ic] = nuevo
    tabla.pop(ie)


def cruces_extremos(n, cantidad):
    cruces = []
    izquierda, derecha = 1, n

    while len(cruces) < cantidad and izquierda < derecha:
        cruces.append((izquierda, izquierda + 1, "izquierda"))
        izquierda += 2

        if len(cruces) >= cantidad or izquierda >= derecha:
            break

        cruces.append((derecha - 1, derecha, "derecha"))
        derecha -= 2

    return cruces


# =========================================================
# INSERCIÓN DE RESULTADOS EN LOSSERS
# =========================================================

def insertar_lossers_patron(lossers, nuevo, numero_batalla):
    """
    Patrón:
    #1 al inicio
    #2 al final
    #3 penúltimo
    #4 segundo
    #5 antepenúltimo
    #6 tercero
    #7 y siguientes continúan alternando hacia el centro.
    """
    if numero_batalla == 1:
        lossers.insert(0, nuevo)
    elif numero_batalla == 2:
        lossers.append(nuevo)
    else:
        posicion = (numero_batalla - 1) // 2
        lossers.insert(posicion, nuevo)


# =========================================================
# COMBATE INICIAL DE WINNERS
# =========================================================

def combate_inicial_winners(
    winners, lossers, a, b, numero, conservar
):
    global combates_totales

    nuevo = resultado(numero)

    quitar_y_reemplazar(winners, a, b, nuevo, conservar)

    # Los resultados de las primeras rondas alimentan Lossers.
    insertar_lossers_patron(lossers, nuevo.copy(), numero)

    combates_totales += 1

    print(f"\nBatalla {numero}: {a['nombre']} vs {b['nombre']}")
    print(f"Resultado provisional: #{numero}")

    mostrar_todo(winners, lossers)


def ejecutar_ronda_winners_1(winners, lossers, cruces, numero):
    auxiliar = winners.copy()

    for a_num, b_num, lado in cruces:
        if not avanzar():
            return False, numero

        a = auxiliar[a_num - 1]
        b = auxiliar[b_num - 1]
        conservar = a if lado == "izquierda" else b

        # Los participantes se buscan por ID en la tabla actual.
        a_actual = winners[buscar(winners, a["id"])]
        b_actual = winners[buscar(winners, b["id"])]

        combate_inicial_winners(
            winners, lossers,
            a_actual, b_actual,
            numero, conservar
        )

        numero += 1

    return True, numero


# =========================================================
# SEGUNDA RONDA INICIAL DE WINNERS
# =========================================================

def programar_ronda_2(tabla):
    prioritarios, restantes = [], []

    for i in range(0, len(tabla) - 1, 2):
        a, b = tabla[i], tabla[i + 1]

        if not a["ha_combatido"] and not b["ha_combatido"]:
            prioritarios.append((a.copy(), b.copy()))
        else:
            restantes.append((a.copy(), b.copy()))

    return prioritarios + restantes


def ejecutar_ronda_winners_2(winners, lossers, numero):
    auxiliar = winners.copy()
    cruces = programar_ronda_2(auxiliar)

    print("\nCruces programados para Winners 2:")
    for i, (a, b) in enumerate(cruces, start=numero):
        print(f"Batalla {i}: {a['nombre']} vs {b['nombre']}")

    for a_aux, b_aux in cruces:
        if not avanzar():
            return False, numero

        a = winners[buscar(winners, a_aux["id"])]
        b = winners[buscar(winners, b_aux["id"])]

        combate_inicial_winners(
            winners, lossers, a, b, numero, a
        )

        numero += 1

    return True, numero


# =========================================================
# PRIMERA RONDA DE LOSSERS
# =========================================================

def ejecutar_ronda_lossers_1(winners, lossers, numero, byes_winners):
    global combates_totales

    print("\n========== RONDA 1 DE LOSSERS ==========")

    n = len(lossers)

    if n < 2:
        print("No hay suficientes participantes en Lossers.")
        return True, numero

    # Reiniciar el estado de combate dentro de esta llave.
    for p in lossers:
        p["ha_combatido"] = False

    rondas, byes, cantidad = calcular_llave(n)

    print(f"Participantes: {n}")
    print(f"Capacidad de llave: {2 ** rondas} (2^{rondas})")
    print(f"Byes iniciales de Lossers: {byes}")
    print(f"Combates de la primera ronda: {cantidad}")

    # Etapa 1: enfrentamientos iniciales desde los extremos.
    auxiliar = lossers.copy()
    cruces = cruces_extremos(n, cantidad)

    programados = [
        (
            auxiliar[a_num - 1].copy(),
            auxiliar[b_num - 1].copy(),
            lado
        )
        for a_num, b_num, lado in cruces
    ]

    for a_aux, b_aux, lado in programados:
        if not avanzar():
            return False, numero

        a = lossers[buscar(lossers, a_aux["id"])]
        b = lossers[buscar(lossers, b_aux["id"])]

        nuevo = resultado(numero)
        conservar = a if lado == "izquierda" else b

        quitar_y_reemplazar(lossers, a, b, nuevo, conservar)

        combates_totales += 1

        print(f"\nBatalla {numero}: {a['nombre']} vs {b['nombre']}")
        print(f"Resultado provisional: #{numero}")
        mostrar_todo(winners, lossers)

        numero += 1

    # Si Winners no tuvo byes, esta fue la única ronda inicial de Lossers.
    # No ejecutar la siguiente etapa: los participantes que avanzaron en los
    # combates y los que recibieron bye deben quedar para la siguiente fase.
    if byes_winners == 0:
        print("\\nWinners tuvo 0 byes: se omite la segunda etapa inicial de Lossers.")
        print("Ronda inicial de Lossers completada.")
        return True, numero

    # Etapa 2: cruces pendientes en orden de tabla.
    # Los resultados de la etapa 1 ya están marcados como combatidos.
    # Se emparejan consecutivamente para que los byes se enfrenten
    # con los resultados de su lado cuando corresponda.
    print("\n--- Enfrentamientos pendientes de Lossers ---")

    auxiliar = [p.copy() for p in lossers]

    # Igual que en la segunda ronda de Winners: primero se programan
    # las parejas consecutivas cuyos dos integrantes aún no han peleado
    # en esta ronda inicial de Lossers. Después se barren las restantes.
    # Así, por ejemplo, 3 vs 2 puede ir antes que el resultado #6 vs 5.
    cruces_pendientes = programar_ronda_2(auxiliar)

    print("\nCruces pendientes programados (sin combate previo primero):")
    for a_aux, b_aux in cruces_pendientes:
        print(f"{a_aux['nombre']} vs {b_aux['nombre']}")

    for a_aux, b_aux in cruces_pendientes:
        if not avanzar():
            return False, numero

        a = lossers[buscar(lossers, a_aux["id"])]
        b = lossers[buscar(lossers, b_aux["id"])]

        nuevo = resultado(numero)
        quitar_y_reemplazar(lossers, a, b, nuevo, a)

        combates_totales += 1

        print(f"\nBatalla {numero}: {a['nombre']} vs {b['nombre']}")
        print(f"Resultado provisional: #{numero}")
        mostrar_todo(winners, lossers)

        numero += 1

    print("\nRonda inicial de Lossers completada.")
    return True, numero


# =========================================================
# RONDAS POSTERIORES DE WINNERS
# =========================================================


def orden_rivales_lossers(lossers, cantidad):
    """
    Orden de colocación para resultados recién caídos de Winners:
    último de la tabla, primero, penúltimo, segundo, etc.
    """
    tabla = lossers.copy()
    orden = []
    izquierda, derecha = 0, len(tabla) - 1

    while izquierda <= derecha and len(orden) < cantidad:
        orden.append(tabla[derecha].copy())
        if len(orden) >= cantidad:
            break

        if izquierda != derecha:
            orden.append(tabla[izquierda].copy())

        izquierda += 1
        derecha -= 1

    return orden


def ejecutar_ronda_winners(winners, lossers, numero):
    """
    Ejecuta una ronda de Winners en orden ascendente de tabla.
    Los nuevos resultados también se colocan en Lossers junto a los
    rivales de la tabla anterior, siguiendo el patrón extremo-interior.
    """
    global combates_totales

    if len(winners) < 2:
        return True, numero

    print("\n========== NUEVA RONDA DE WINNERS ==========")

    auxiliar = [p.copy() for p in winners]
    cruces = [
        (auxiliar[i], auxiliar[i + 1])
        for i in range(0, len(auxiliar) - 1, 2)
    ]

    for a_aux, b_aux in cruces:
        print(
            f"Combate programado: "
            f"{a_aux['nombre']} vs {b_aux['nombre']}"
        )

    # Los rivales se calculan sobre una fotografía previa a la ronda.
    # Así no cambian por los resultados que se van insertando.
    rivales = orden_rivales_lossers(lossers, len(cruces))
    resultados_ronda = []

    for a_aux, b_aux in cruces:
        if not avanzar():
            return False, numero

        a = winners[buscar(winners, a_aux["id"])]
        b = winners[buscar(winners, b_aux["id"])]

        nombre_a, nombre_b = a["nombre"], b["nombre"]
        nuevo = resultado(numero, estado_lossers="caido")

        quitar_y_reemplazar(winners, a, b, nuevo, a)
        resultados_ronda.append(nuevo.copy())
        combates_totales += 1

        print(f"\nBatalla {numero}: {nombre_a} vs {nombre_b}")
        print(f"Resultado provisional: #{numero}")

        # Colocar cada resultado inmediatamente después del rival que le
        # corresponde. Las búsquedas por ID evitan errores de índices.
        indice = len(resultados_ronda) - 1
        if indice < len(rivales):
            rival_id = rivales[indice]["id"]
            pos_rival = buscar(lossers, rival_id)
            lossers.insert(pos_rival + 1, nuevo.copy())
        else:
            # Si no hay rivales antiguos suficientes, el resultado queda
            # al final y participará en las rondas internas de Lossers.
            lossers.append(nuevo.copy())

        mostrar_todo(winners, lossers)
        numero += 1

    return True, numero


def ejecutar_ronda_interna_lossers(winners, lossers, numero):
    """
    Ejecuta una etapa de Lossers con la misma lógica de byes de una llave.
    Los cruces se calculan desde los extremos de la tabla hacia el centro.
    Por ejemplo, con 5 participantes se juega primero un combate; los otros
    tres reciben bye. En la siguiente etapa, los 4 restantes juegan dos veces.
    """
    global combates_totales

    n = len(lossers)
    if n < 2:
        return True, numero

    _, byes, cantidad = calcular_llave(n)
    cruces = cruces_extremos(n, cantidad)

    print("\n========== NUEVA ETAPA DE LOSSERS ==========")
    print(f"Participantes: {n} | Byes de esta etapa: {byes} | Combates: {cantidad}")

    auxiliar = [p.copy() for p in lossers]
    programados = [
        (auxiliar[a_num - 1], auxiliar[b_num - 1], lado)
        for a_num, b_num, lado in cruces
    ]

    for a_aux, b_aux, lado in programados:
        print(f"Combate programado: {a_aux['nombre']} vs {b_aux['nombre']}")

    for a_aux, b_aux, lado in programados:
        if not avanzar():
            return False, numero

        a = lossers[buscar(lossers, a_aux["id"])]
        b = lossers[buscar(lossers, b_aux["id"])]
        nombre_a, nombre_b = a["nombre"], b["nombre"]
        nuevo = resultado(numero, estado_lossers="pendiente")
        conservar = a if lado == "izquierda" else b

        quitar_y_reemplazar(lossers, a, b, nuevo, conservar)
        combates_totales += 1

        print(f"\nBatalla {numero}: {nombre_a} vs {nombre_b}")
        print(f"Resultado provisional: #{numero}")
        mostrar_todo(winners, lossers)
        numero += 1

    return True, numero


def resolver_lossers_hasta_uno(winners, lossers, numero):
    """
    Cuando Winners ya tiene un campeón, juega rondas internas de Lossers
    hasta dejar un solo representante.
    """
    while len(lossers) > 1:
        ok, numero = ejecutar_ronda_interna_lossers(
            winners, lossers, numero
        )
        if not ok:
            return False, numero

    return True, numero



# =========================================================
# FINAL Y POSIBLE REVANCHA
# =========================================================

def elegir_ganador_final(
    a, b,
    etiqueta_a="viene de Winners",
    etiqueta_b="viene de Lossers"
):
    while True:
        print("\n¿Quién gana este combate final?")
        print(f"1 = {a['nombre']} ({etiqueta_a})")
        print(f"2 = {b['nombre']} ({etiqueta_b})")
        print("q = salir")

        opcion = input("Selecciona: ").strip().lower()

        if opcion == "q":
            return None
        if opcion == "1":
            return 1
        if opcion == "2":
            return 2

        print("Opción no válida.")



def ejecutar_final(winners, lossers, numero):
    global combates_totales

    if not winners or not lossers:
        print("No hay participantes suficientes para la final.")
        return False, numero

    print("\n" + "#" * 55)
    print("GRAN FINAL")
    print("#" * 55)

    campeon_winners = winners[0].copy()
    campeon_lossers = lossers[0].copy()

    # -------------------------------------------------
    # BATALLA FINAL
    # -------------------------------------------------
    if not avanzar():
        return False, numero

    print(
        f"\nFinal #{numero}: "
        f"{campeon_winners['nombre']} vs "
        f"{campeon_lossers['nombre']}"
    )

    ganador = elegir_ganador_final(
        campeon_winners,
        campeon_lossers
    )

    if ganador is None:
        return False, numero

    combates_totales += 1
    numero += 1

    if ganador == 1:
        # Gana Winners: permanece su campeón y Lossers queda vacía.
        winners[:] = [campeon_winners]
        lossers.clear()

        print(f"\nCAMPEÓN: {campeon_winners['nombre']}")

        mostrar_todo(winners, lossers)
        return True, numero

    # -------------------------------------------------
    # GANA LOSSERS: SE NECESITA UNA REVANCHA
    # -------------------------------------------------
    print(f"\nGana el representante de Lossers: "
          f"{campeon_lossers['nombre']}")
    print("Se requiere una revancha final.")

    # Estado provisional antes de la revancha:
    # Winners vacío y los dos participantes en Lossers.
    winners.clear()
    lossers[:] = [campeon_lossers, campeon_winners]

    mostrar_todo(winners, lossers)

    if not avanzar():
        return False, numero

    print(
        f"\nRevancha #{numero}: "
        f"{campeon_lossers['nombre']} vs "
        f"{campeon_winners['nombre']}"
    )

    ganador_revancha = elegir_ganador_final(
        campeon_lossers,
        campeon_winners,
        etiqueta_a="viene de Lossers",
        etiqueta_b="viene de Winners"
    )

    if ganador_revancha is None:
        return False, numero

    combates_totales += 1
    numero += 1

    if ganador_revancha == 1:
        # Gana el representante de Lossers.
        campeon = campeon_lossers
    else:
        # Gana el antiguo campeón de Winners.
        campeon = campeon_winners

    # Después de la revancha solo queda el campeón en Lossers.
    winners.clear()
    lossers[:] = [campeon]

    print(f"\nCAMPEÓN DEFINITIVO: {campeon['nombre']}")

    mostrar_todo(winners, lossers)

    return True, numero


# =========================================================
# SIMULADOR
# =========================================================

def simular():
    global combates_totales
    combates_totales = 0

    try:
        n = int(input("Número de participantes: "))

        if n < 2:
            print("Debe haber al menos 2 participantes.")
            return

    except ValueError:
        print("Ingresa un entero válido.")
        return

    rondas, byes, cantidad = calcular_llave(n)

    winners = [
        participante(str(i))
        for i in range(1, n + 1)
    ]
    lossers = []

    mostrar_todo(winners, lossers)

    numero = 1

    # -----------------------------------------------------
    # FASE INICIAL DE WINNERS
    # -----------------------------------------------------

    print("\n========== RONDA 1 DE WINNERS ==========")

    cruces = cruces_extremos(n, cantidad)

    ok, numero = ejecutar_ronda_winners_1(
        winners, lossers, cruces, numero
    )

    if not ok:
        return

    # Si la llave inicial de Winners no tiene byes, no se juega una
    # segunda ronda inicial: se pasa directamente a la fase inicial de Lossers.
    if byes > 0:
        print("\\n========== RONDA 2 DE WINNERS ==========")

        ok, numero = ejecutar_ronda_winners_2(
            winners, lossers, numero
        )

        if not ok:
            return
    else:
        print("\\nWinners tiene 0 byes: se omite la ronda 2 inicial y se pasa a Lossers.")

    # -----------------------------------------------------
    # FASE INICIAL DE LOSSERS
    # -----------------------------------------------------

    ok, numero = ejecutar_ronda_lossers_1(
        winners, lossers, numero, byes
    )

    if not ok:
        return

    # Todo lo que queda tras la fase inicial forma la primera bolsa de
    # pendientes de Lossers. Los caídos de Winners de rondas posteriores
    # se distinguirán para no cruzarlos antes de tiempo.
    for p in lossers:
        p["estado_lossers"] = "pendiente"

    # -----------------------------------------------------
    # CICLO POSTERIOR: WINNERS Y LOSSERS
    # -----------------------------------------------------

    while len(winners) > 1:
        # Cada combate de la próxima ronda de Winners producirá un nuevo
        # participante para Lossers. Primero calculamos cuántos caerán.
        combates_winners_siguientes = len(winners) // 2

        # Reducimos Lossers por etapas de llave (respetando byes y cruces
        # extremos-centro) hasta que queden tantos o menos participantes
        # como caídos que generará la próxima ronda de Winners.
        # No es una regla fija por cantidad de tablas: se recalcula cada vez.
        if len(lossers) > combates_winners_siguientes:
            ok, numero = ejecutar_ronda_interna_lossers(
                winners, lossers, numero
            )
            if not ok:
                return
            continue

        # Ya hay espacio para incorporar a los caídos de Winners sin
        # forzar enfrentamientos prematuros entre ellos.
        ok, numero = ejecutar_ronda_winners(
            winners, lossers, numero
        )
        if not ok:
            return

    # Winners ya tiene campeón: resolver Lossers hasta que quede uno.
    ok, numero = resolver_lossers_hasta_uno(winners, lossers, numero)
    if not ok:
        return

    # -----------------------------------------------------
    # FINAL
    # -----------------------------------------------------

    if len(winners) == 1 and len(lossers) == 1:
        ejecutar_final(winners, lossers, numero)
    else:
        print("\nEl torneo llegó a un estado que requiere revisión.")
        mostrar_todo(winners, lossers)

    print("\nFin del torneo.")
    print(f"Combates acumulados: {combates_totales}")


if __name__ == "__main__":
    simular()
