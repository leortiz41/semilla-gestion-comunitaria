# Referencias históricas — no ejecutar como migraciones

`005_expediente_comunitario_local.sql` es la copia exacta del script local recuperado durante la reconciliación del expediente. Se conserva para comparar y probar compatibilidad con bases existentes; no pertenece a la secuencia ejecutable ni debe aplicarse adicionalmente.

Las migraciones versionadas están exclusivamente en `database/sql/`. Las pruebas de compatibilidad usan esta referencia para reconstruir la variante local en una base temporal.
