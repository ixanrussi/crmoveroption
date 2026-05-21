## Cambio

En la tarjeta **Remuneración fija** del formulario de afiliado, reemplazar el término "FTD" por "CPA".

### Archivo afectado
- `src/pages/Afiliados.tsx`

### Textos a cambiar
- Label: `Volumen mínimo de FTD/mes` → `Volumen mínimo de CPA/mes`
- Placeholder: `Ej. 50` se mantiene
- Nota inferior: `Si el afiliado alcanza el volumen mínimo de FTDs en el mes, recibe la remuneración fija. En caso contrario, se le paga el CPA fallback por FTD.` → `Si el afiliado alcanza el volumen mínimo de CPAs en el mes, recibe la remuneración fija. En caso contrario, se le paga el CPA fallback por CPA.`

No se modifican nombres de campos en base de datos ni en el edge function (siguen llamándose `fixed_remuneration_min_ftd`); solo cambia el texto visible.