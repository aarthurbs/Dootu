#!/usr/bin/env python3
"""
Lab autorizado — teste de resiliencia do login do COPS (Supabase Auth).

USO ETICO E RESTRITO (regra do Modulo 00 do CyberLab):
- Somente no SEU ambiente autorizado (projeto COPS, copa.useebrasil.com.br).
- Conta EXCLUSIVA de laboratorio -- nunca conta de usuario real ou admin.
- Objetivo: VERIFICAR as defesas (rate limit, logs, enumeracao de e-mail),
  NAO invadir. Nao contorna CAPTCHA, bloqueio de conta nem limite de requisicoes.
- Usa a apikey PUBLICA (anon), o mesmo fluxo do navegador. Nunca a service_role.

Preencha os valores <...> a partir da captura no Burp
(1 login com senha errada + 1 com a senha certa).

Rodar:  python docs/lab-cops-login.py     (precisa de: pip install requests)
"""
import time

import requests

# ── parametros (pegue do Burp) ─────────────────────────────
SUPABASE_URL = "<SUPABASE_URL>"           # ex.: https://xxxxxxxx.supabase.co
ANON_KEY = "<ANON_KEY>"                    # apikey PUBLICA (anon) -- NUNCA a service_role
EMAIL = "lab-teste@exemplo.com"            # conta EXCLUSIVA de laboratorio
SENHAS = ["admin123", "teste123", "cops123", "erro456", "<SENHA_CORRETA>"]

MAX_TENTATIVAS = 5      # teto rigido de tentativas
INTERVALO_S = 2         # pausa (segundos) entre tentativas

URL = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
HEADERS = {"apikey": ANON_KEY, "Content-Type": "application/json"}


def tentar(email, senha):
    """Uma tentativa de login. Devolve (status_http, tempo_ms)."""
    inicio = time.time()
    r = requests.post(
        URL, headers=HEADERS,
        json={"email": email, "password": senha}, timeout=10,
    )
    ms = round((time.time() - inicio) * 1000)
    return r.status_code, ms


def main():
    for i, senha in enumerate(SENHAS[:MAX_TENTATIVAS], start=1):
        status, ms = tentar(EMAIL, senha)
        resultado = "sucesso" if status == 200 else "falhou"
        print(f"Tentativa {i} | senha: {senha:<16} | {resultado} | HTTP {status} | {ms} ms")

        # ── regras de parada: pare na hora, nao force a defesa ──
        if status == 200:
            print(">> senha correta aceita. Parando (objetivo cumprido).")
            break
        if status == 429:
            print(">> 429 Too Many Requests: rate limit ativo. Parando.")
            break
        if status not in (400, 401):
            print(f">> resposta inesperada (HTTP {status}). Parando por seguranca.")
            break

        if i < MAX_TENTATIVAS:
            time.sleep(INTERVALO_S)


if __name__ == "__main__":
    main()
