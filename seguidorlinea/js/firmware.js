/* firmware.js — genera el firmware de Arduino (Nano/Uno + TB6612FNG) a partir de la ficha técnica.
   Devuelve { "nombre.ext": "contenido", ... }. Se puede usar en el navegador o en Node. */
(function (g) {
  "use strict";
  const num = (x, d) => Number(x).toFixed(d);

  function generarFirmware(f) {
    const n = Math.round(f.nSens);
    const mux = !!f.mux;
    const pinesA = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"];
    const caben = mux ? n <= 16 : n <= 8;
    const pines = mux ? [] : (caben ? pinesA.slice(0, n) : pinesA);
    const usarVbat = mux ? 1 : (n <= 7 ? 1 : 0);
    const adcRapido = (f.tAdcUs || 112) < 50 ? 1 : 0;
    const compensar = f.compensarV ? 1 : 0;
    const out = {};

    out["config.h"] =
`#pragma once
// ===== Configuración generada desde la ficha técnica: ${f.version} =====
// Tarjeta: Arduino Nano / Uno (ATmega328P, 16 MHz) · Puente H: TB6612FNG

// ---- Sensores (Módulo 2) ----
${mux ? `const uint8_t NSENS = ${Math.min(n, 16)};                  // barra con multiplexor 16:1 (CD74HC4067)
const uint8_t MUX_S[4] = {A0, A1, A2, A3};      // S0–S3 (D14–D17)
const uint8_t MUX_SIG = A4;                     // salida analógica común
const uint8_t PIN_LEDS = 11;                    // LON: enciende los emisores IR` : `const uint8_t NSENS = ${caben ? n : 8};${caben ? "" : "   // ¡La ficha pide " + n + " sensores! El Nano sólo tiene 8 entradas analógicas: usar multiplexor."}
const uint8_t PIN_SENS[NSENS] = {${pines.join(", ")}};   // sensor 0 = el de la izquierda`}
#define ADC_RAPIDO ${adcRapido}                    // 1 = preescalador 16: ≈16 µs por conversión
const float PASO_MM = ${num(f.pasoSens * 1000, 1)};                // separación entre sensores${f.barraForma === "curva" ? " (medida sobre el arco)" : ""}
const float RADIO_BARRA_MM = ${f.barraForma === "curva" ? num(f.radioBarra * 1000, 1) : "0"};        // 0 = barra recta

// ---- Puente H TB6612FNG (Módulo 3) ----${mux ? "\n// Pines del driver propuestos: confirmar con el código de prueba de la PCB." : ""}
const uint8_t PWMA = 9,  AIN1 = 7,  AIN2 = 8;     // motor izquierdo (D9: PWM del Timer1)
const uint8_t PWMB = 10, BIN1 = ${mux ? 5 : 11}, BIN2 = ${mux ? 6 : 12};    // motor derecho  (D10: PWM del Timer1)
const uint8_t STBY = 4;
const uint8_t BOTON = 2, LED = 13;

// ---- Batería ----
#define USAR_VBAT ${usarVbat}        ${usarVbat ? "// divisor 10k/10k en A7" : "// con " + n + " sensores no queda entrada analógica libre para medir V_bat"}
#define COMPENSAR_V ${compensar && usarVbat ? 1 : 0}      ${compensar && !usarVbat ? "// la ficha pide compensar, pero no hay entrada para V_bat" : ""}
const uint8_t PIN_VBAT = A7;
const float DIV_VBAT = 2.0;                 // (R1 + R2) / R2
const float CAIDA_DRIVER = ${num(f.caidaDriver || 0, 2)};          // V, Módulo 3
const float V_REF_MOTOR = ${num(Math.min(0.9 * f.vNom, 0.89 * f.vBat - (f.caidaDriver || 0)), 2)};          // V que se quiere "ver" en el motor al 100 % (alcanzable aun con la batería baja)
const float V_BAT_MIN = ${num(0.89 * f.vBat, 1)};                // LiPo: no descargar más (≈ 3.3 V por celda)

// ---- Control (Módulo 5) ----
const unsigned long T_US = ${Math.round(f.periodo * 1e6)};          // periodo del lazo: ${num(f.periodo * 1000, 0)} ms
float Kp = ${num(f.kp, 3)}, Ki = ${num(f.ki, 3)}, Kd = ${num(f.kd, 4)};
float BASE = ${num(f.vBase, 2)};                         // velocidad base (fracción de PWM)
const float ALFA_D = ${num(f.filtroD || 0, 2)};                 // filtro de la derivada
const float LIM_I = 0.5;                    // anti-windup: |Ki·integral| ≤ 50 % de PWM

// ---- Estados (Módulo 6) ----
const unsigned long T_CALIBRA_MS = 3000;    // girar sobre su eje para calibrar
const unsigned long T_PERDIDA_MS = 1000;    // tiempo máximo buscando la línea
const unsigned long T_META_MS = 150;        // cruzar recto la marca de meta
const uint8_t VUELTAS = 2;

// ---- Telemetría ----
const long BAUD = ${f.baud || 115200};
const uint8_t TELEM_CADA = ${Math.max(1, Math.round(f.telemCada || 4))};           // enviar 1 de cada N periodos
`;

    out["sensores.h"] =
`#pragma once
// ===== Lectura, calibración y error (Módulo 2) =====
int minS[NSENS], maxS[NSENS];
float lect[NSENS];
float ultimoSigno = 1;
bool lineaVisible = false, todosNegros = false;

${mux ? `void iniciarSensores() {
  for (uint8_t b = 0; b < 4; b++) pinMode(MUX_S[b], OUTPUT);
  pinMode(PIN_LEDS, OUTPUT);
  digitalWrite(PIN_LEDS, HIGH);                 // emisores encendidos
}

int leerCanal(uint8_t i) {                      // seleccionar el canal y convertir
  for (uint8_t b = 0; b < 4; b++) digitalWrite(MUX_S[b], (i >> b) & 1);
  delayMicroseconds(5);                         // asentamiento del multiplexor
  return analogRead(MUX_SIG);
}` : `void iniciarSensores() {}

int leerCanal(uint8_t i) { return analogRead(PIN_SENS[i]); }`}

// posición lateral del sensor i en mm (sensor 0 = izquierda); en barra curva, R·sen(φ)
float posLateral(uint8_t i) {
  float s = ((NSENS - 1) / 2.0 - i) * PASO_MM;
  return RADIO_BARRA_MM > 0 ? RADIO_BARRA_MM * sin(s / RADIO_BARRA_MM) : s;
}

void iniciarCalibracion() {
  for (uint8_t i = 0; i < NSENS; i++) { minS[i] = 1023; maxS[i] = 0; }
}

void pasoCalibracion() {              // se llama en cada periodo mientras gira
  for (uint8_t i = 0; i < NSENS; i++) {
    int c = leerCanal(i);
    if (c < minS[i]) minS[i] = c;
    if (c > maxS[i]) maxS[i] = c;
  }
}

// Error normalizado: -1 (línea a la derecha) … +1 (a la izquierda); 1.2 con el signo anterior si se perdió
float leerError() {
  float suma = 0, sumaY = 0, maximo = 0;
  uint8_t negros = 0;
  for (uint8_t i = 0; i < NSENS; i++) {
    int c = leerCanal(i);
    float v = (c - minS[i]) / float(max(1, maxS[i] - minS[i]));
    v = constrain(v, 0.0, 1.0);
    lect[i] = v;
    if (v > maximo) maximo = v;
    if (v > 0.6) negros++;
    if (v < 0.2) v = 0;                         // ignorar el blanco
    float y = posLateral(i);
    suma += v;
    sumaY += v * y;
  }
  todosNegros = (negros >= NSENS - 1);          // marca transversal (meta)
  lineaVisible = !(maximo < 0.35 || suma == 0);
  if (!lineaVisible) return 1.2 * ultimoSigno;
  float e = (sumaY / suma) / posLateral(0);
  if (fabs(e) > 0.15) ultimoSigno = (e > 0) ? 1 : -1;
  return e;
}
`;

    out["motores.h"] =
`#pragma once
// ===== Puente H, PWM y batería (Módulo 3) =====
float escalaV = 1.0;                  // compensación de voltaje

void iniciarMotores() {
  uint8_t p[] = {PWMA, AIN1, AIN2, PWMB, BIN1, BIN2, STBY};
  for (uint8_t i = 0; i < sizeof(p); i++) pinMode(p[i], OUTPUT);
  digitalWrite(STBY, HIGH);
  // PWM de D9 y D10 a ~31 kHz (Timer1 sin preescalador): sin zumbido audible.
  // No afecta a millis() ni micros(), que usan el Timer0.
  TCCR1B = (TCCR1B & 0b11111000) | 0x01;
}

void unMotor(uint8_t pwm, uint8_t in1, uint8_t in2, float d) {
  d = constrain(d * escalaV, -1.0, 1.0);        // saturación explícita
  if (d >= 0) { digitalWrite(in1, HIGH); digitalWrite(in2, LOW); }
  else        { digitalWrite(in1, LOW);  digitalWrite(in2, HIGH); d = -d; }
  analogWrite(pwm, (int)(d * 255));
}

void motores(float izq, float der) {
  unMotor(PWMA, AIN1, AIN2, izq);
  unMotor(PWMB, BIN1, BIN2, der);
}

void frenar() {                       // TB6612: IN1 = IN2 = H → freno en corto
  digitalWrite(AIN1, HIGH); digitalWrite(AIN2, HIGH);
  digitalWrite(BIN1, HIGH); digitalWrite(BIN2, HIGH);
  analogWrite(PWMA, 255); analogWrite(PWMB, 255);
}

float leerVbat() {
#if USAR_VBAT
  return analogRead(PIN_VBAT) * (5.0 / 1023.0) * DIV_VBAT;
#else
  return 99.0;                        // sin medición: nunca se detiene por batería
#endif
}

void actualizarCompensacion() {
#if COMPENSAR_V
  float v = leerVbat() - CAIDA_DRIVER;
  escalaV = (v > 1.0) ? V_REF_MOTOR / v : 1.0;
#endif
}
`;

    out["pid.h"] =
`#pragma once
// ===== PID discreto (Módulo 5) =====
float integral = 0, ePrev = 0, dFilt = 0;

void reiniciarPID() { integral = 0; ePrev = 0; dFilt = 0; }

float pid(float e) {
  const float T = T_US / 1e6;
  integral += e * T;
  if (Ki > 0) integral = constrain(integral, -LIM_I / Ki, LIM_I / Ki);   // anti-windup
  float d = (e - ePrev) / T;
  ePrev = e;
  dFilt = ALFA_D * dFilt + (1 - ALFA_D) * d;                              // filtro de la derivada
  return Kp * e + Ki * integral + Kd * dFilt;
}
`;

    out["seguidor.ino"] =
`// ===== Seguidor de línea: programa principal (Módulo 6) =====
#include "config.h"
#include "sensores.h"
#include "motores.h"
#include "pid.h"

enum Estado { CALIBRANDO, ESPERA, SIGUIENDO, PERDIDA, META, PARO };
Estado estado = CALIBRANDO;
unsigned long tEstado = 0;            // millis() al entrar al estado actual
unsigned long tSig = 0;               // micros() del siguiente periodo
uint8_t vueltas = 0, nTelem = 0;
float e = 0, u = 0;

void cambiar(Estado nuevo) { estado = nuevo; tEstado = millis(); }

bool botonPresionado() {              // detecta el flanco de bajada con antirrebote
  static bool antes = HIGH;
  static unsigned long tCambio = 0;
  bool ahora = digitalRead(BOTON);
  if (ahora != antes && millis() - tCambio > 30) {
    tCambio = millis();
    antes = ahora;
    return ahora == LOW;
  }
  return false;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(BOTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  iniciarMotores();
  iniciarSensores();
#if ADC_RAPIDO
  ADCSRA = (ADCSRA & 0xF8) | 0x04;    // preescalador 16
#endif
  iniciarCalibracion();
  cambiar(CALIBRANDO);
  tSig = micros();
}

void loop() {
  // ---- periodo fijo: nada de delay() ----
  if ((long)(micros() - tSig) < 0) return;
  tSig += T_US;

  unsigned long t = millis() - tEstado;
  bool boton = botonPresionado();
  if (estado != PARO && leerVbat() < V_BAT_MIN) { frenar(); cambiar(PARO); }

  switch (estado) {
    case CALIBRANDO:                    // girar sobre su eje para ver blanco y negro
      motores(-0.35, 0.35);
      pasoCalibracion();
      if (t > T_CALIBRA_MS) { frenar(); cambiar(ESPERA); }
      break;

    case ESPERA:                        // listo en la pista, esperando el botón
      digitalWrite(LED, (millis() / 250) % 2);
      if (boton) { reiniciarPID(); vueltas = 0; cambiar(SIGUIENDO); }
      break;

    case SIGUIENDO:
      e = leerError();
      if (!lineaVisible) { cambiar(PERDIDA); break; }
      if (todosNegros)   { cambiar(META);    break; }
      u = pid(e);
      actualizarCompensacion();
      motores(BASE - u, BASE + u);
      break;

    case PERDIDA:                       // girar hacia donde se vio la línea por última vez
      e = leerError();
      motores(-0.3 * ultimoSigno, 0.3 * ultimoSigno);
      if (lineaVisible) cambiar(SIGUIENDO);
      else if (t > T_PERDIDA_MS) { frenar(); cambiar(PARO); }
      break;

    case META:                          // cruzar recto la marca transversal
      motores(BASE, BASE);
      if (t > T_META_MS) {
        vueltas++;
        if (vueltas >= VUELTAS) { frenar(); cambiar(PARO); }
        else cambiar(SIGUIENDO);
      }
      break;

    case PARO:
      frenar();
      digitalWrite(LED, HIGH);
      if (boton) { digitalWrite(LED, LOW); cambiar(ESPERA); }
      break;
  }

  // ---- telemetría: t_ms, estado, e, u ----
  if (++nTelem >= TELEM_CADA) {
    nTelem = 0;
    Serial.print(millis()); Serial.print(',');
    Serial.print((int)estado); Serial.print(',');
    Serial.print(e, 3); Serial.print(',');
    Serial.println(u, 3);
  }
}
`;
    return out;
  }

  g.generarFirmware = generarFirmware;
  if (typeof module !== "undefined") module.exports = { generarFirmware };
})(typeof window !== "undefined" ? window : globalThis);
