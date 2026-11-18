# 35 — Remote push reproducibility

## État

Push GitHub historique **403** (org credentials). CODE_COMPLETE local.

## Procédure GO

1. Configurer credentials org avec droit `contents: write`.
2. `git push -u origin HEAD` Edge + FE + BB.
3. Pin SHAs dans evidence pack.
4. CI contract control/v1 + vitest suites critiques.

## Exception

EX-E12-PUSH / EX-P11-003 restent ouvertes **uniquement** tant que 403.  
Dès push OK : cocher Gate G10 item remote + fermer exception.
