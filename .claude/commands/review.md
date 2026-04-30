# Command: /review

Voer een code review uit op de huidige branch-wijzigingen.

## Stappen

1. `git diff main...HEAD` — bekijk alle gewijzigde bestanden
2. Controleer op architectuurregels uit `.claude/rules/architecture_rules.md`
3. Controleer op codestijl uit `.claude/rules/code-style.md`
4. Rapporteer: APPROVED / NEEDS FIXES met specifieke bevindingen per bestand
5. Bij APPROVED: push naar `main` om deploy te triggeren
