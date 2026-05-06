// LATAM + main international currencies (ISO 4217 codes)
export const CURRENCIES = [
  "USD", // Dólar estadounidense
  "EUR", // Euro
  "GBP", // Libra esterlina
  "ARS", // Argentina - Peso argentino
  "BOB", // Bolivia - Boliviano
  "BRL", // Brasil - Real brasileño
  "CLP", // Chile - Peso chileno
  "COP", // Colombia - Peso colombiano
  "CRC", // Costa Rica - Colón
  "CUP", // Cuba - Peso cubano
  "DOP", // República Dominicana - Peso dominicano
  "GTQ", // Guatemala - Quetzal
  "HNL", // Honduras - Lempira
  "HTG", // Haití - Gourde
  "MXN", // México - Peso mexicano
  "NIO", // Nicaragua - Córdoba
  "PAB", // Panamá - Balboa
  "PEN", // Perú - Sol
  "PYG", // Paraguay - Guaraní
  "SVC", // El Salvador - Colón salvadoreño
  "UYU", // Uruguay - Peso uruguayo
  "VES", // Venezuela - Bolívar soberano
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];
