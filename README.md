# DeudaZero — Liquidador Comparativo de Deudas y MSI

> **Enlaces del proyecto**

**Link:** `https://hunabbohorquez.github.io/DeudaZero/`

**Repositorio en GitHub:** `https://github.com/HunabBohorquez/DeudaZero`

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

## Descripción

DeudaZero es un simulador web que compara tres formas de pagar un portafolio de deudas (tarjetas, préstamos personales y compras a Meses Sin Intereses): **Solo Mínimos**, **Bola de Nieve** y **Avalancha**. Muestra meses para liquidar, intereses totales, monto desembolsado, ahorro frente a pagar solo mínimos, una gráfica de la evolución del saldo y el mes exacto en que se liquida cada deuda. Está hecho con HTML5, CSS3 y JavaScript ES6+ vanilla, sin librerías externas. Los datos se guardan en `localStorage` y pueden exportarse a JSON.

## Métodos financieros

Cada mes, para cada deuda con saldo: `interés = saldo × (CAT / 12 / 100)` (redondeado a centavos), se suma al saldo y luego se aplican los pagos. Las deudas MSI siempre usan tasa 0%. La simulación se detiene al liquidar todo o a los **360 meses**.

- **Solo Mínimos:** cada deuda recibe únicamente su pago mínimo. Si el mínimo no cubre el interés mensual, la app lanza una alerta porque esa deuda nunca se liquida.
- **Bola de Nieve:** deudas ordenadas de menor a mayor saldo actual. El presupuesto mensual es la suma de todos los mínimos más el abono extra. Se paga el mínimo de cada deuda activa y el resto (extra más mínimos liberados) va a la deuda más pequeña.
- **Avalancha:** igual, pero ordenadas de mayor a menor CAT (empate: menor saldo primero). El excedente va a la deuda más cara.

## Ejecución

1. Guarda `index.html`, `styles.css`, `app.js` y `README.md` en la misma carpeta.
2. Abre `index.html` en cualquier navegador moderno. No requiere servidor ni instalación.
3. Pulsa **Cargar Portafolio Demo** para ver un ejemplo.

## Pruebas Verificables

**Portafolio Demo** (saldo total $60,300.00):

| Deuda | Tipo | Saldo | CAT | Mínimo |
|---|---|---|---|---|
| Tarjeta bancaria | Tarjeta | $18,500 | 48% | $925 |
| Tienda departamental | Tarjeta | $7,200 | 62% | $450 |
| Compra a 12 MSI | MSI | $9,600 | 0% | $800 |
| Préstamo personal | Préstamo | $25,000 | 24% | $1,100 |

### Con abono extra de $0

| Estrategia | Meses | Intereses | Total desembolsado | Ahorro vs. mínimos |
|---|---|---|---|---|
| Solo Mínimos | 42 | $36,587.65 | $96,887.65 | — |
| Bola de Nieve | 27 | $27,815.23 | $88,115.23 | $8,772.42 y 15 meses |
| Avalancha | 27 | $27,815.23 | $88,115.23 | $8,772.42 y 15 meses |

Con $0 de extra, ambos métodos coinciden: el único dinero que se redirige son los mínimos liberados. Meses de liquidación en Bola de Nieve y Avalancha: MSI 12, Tienda 18, Tarjeta 26, Préstamo 27.

### Con abono extra de $1,500

| Estrategia | Meses | Intereses | Total desembolsado | Ahorro vs. mínimos |
|---|---|---|---|---|
| Solo Mínimos | 42 | $36,587.65 | $96,887.65 | — |
| Bola de Nieve | 16 | $13,755.27 | $74,055.27 | $22,832.38 y 26 meses |
| Avalancha | 16 | $12,908.60 | $73,208.60 | $23,679.05 y 26 meses |

Meses de liquidación con $1,500 de extra:

- **Solo Mínimos:** MSI 12, Préstamo 31, Tienda 35, Tarjeta 42.
- **Bola de Nieve:** Tienda 5, MSI 7, Tarjeta 12, Préstamo 16.
- **Avalancha:** Tienda 5, Tarjeta 12, MSI 12, Préstamo 16.

Avalancha ahorra $846.67 más que Bola de Nieve con $1,500 de extra, porque ataca primero las deudas con mayor tasa.
