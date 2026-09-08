#!/usr/bin/env python3
"""
Lab autorizado -- a "janela de palpites" do COPS/Copa e so no front-end?

USO ETICO E RESTRITO (regra do Modulo 00 do CyberLab):
- Somente no SEU sistema (projeto COPS, copa.useebrasil.com.br).
- Conta EXCLUSIVA de laboratorio, e o PARTICIPANTE_ID DESSA conta -- nunca de
  outro participante. Nao e pra trapacear: o script escreve so no palpite da
  propria conta de lab e RESTAURA o valor original no fim.
- Objetivo: VERIFICAR se o servidor (Supabase + RLS) tambem barra a escrita
  depois do prazo, ou se so o React (Copa.js) esconde o botao.
- Usa a apikey PUBLICA (anon) + o token do proprio login -- o mesmo fluxo do
  navegador. NUNCA a service_role.

Contexto (extraido de arquivo/Copa.js):
- Tabela `palpites`, upsert em POST /rest/v1/palpites?on_conflict=participante_id,jogo_id
- Colunas: participante_id, jogo_id, gols_casa, gols_fora
- Regra do front: "Aposta de cada fase fecha 1 dia antes do 1o jogo" (checada no cliente).

Como usar:
  1) pip install requests
  2) Preencha os <...> abaixo. A ANON_KEY esta no painel do Supabase
     (Settings > API, chave anon/public) ou na aba Network do navegador (header apikey).
  3) Escolha um JOGO_ID de uma fase JA FECHADA (a que voce quer testar).
  4) python docs/lab-copa-janela-palpite.py
"""
import sys

import requests

# -- parametros --------------------------------------------------------------
SUPABASE_URL = "https://vrjdholzmmnnyzkcjome.supabase.co"  # endpoint publico do COPS
ANON_KEY = "<ANON_KEY>"          # apikey PUBLICA (anon) -- NUNCA a service_role
EMAIL = "<EMAIL_LAB>"            # conta EXCLUSIVA de laboratorio
SENHA = "<SENHA_LAB>"

PARTICIPANTE_ID = "<PARTICIPANTE_ID_DA_CONTA_LAB>"  # id do participante DESSA conta
JOGO_ID_FECHADO = "<JOGO_ID_DE_FASE_FECHADA>"       # jogo cuja janela ja fechou
GOLS_CASA, GOLS_FORA = 9, 9      # valor-marcador so pra este teste

TIMEOUT = 10
AUTH_URL = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
PALPITES_URL = f"{SUPABASE_URL}/rest/v1/palpites"


def _headers(token):
    return {"apikey": ANON_KEY, "Authorization": f"Bearer {token}"}


def login():
    r = requests.post(
        AUTH_URL,
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": SENHA},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        print(f"Login falhou (HTTP {r.status_code}). Confira EMAIL/SENHA/ANON_KEY.")
        sys.exit(1)
    return r.json()["access_token"]


def ler_palpite(token):
    """Valor atual do palpite (pra restaurar depois). None se nao existir."""
    r = requests.get(
        f"{PALPITES_URL}?participante_id=eq.{PARTICIPANTE_ID}"
        f"&jogo_id=eq.{JOGO_ID_FECHADO}&select=gols_casa,gols_fora",
        headers=_headers(token),
        timeout=TIMEOUT,
    )
    linhas = r.json() if r.ok else []
    return linhas[0] if linhas else None


def escrever(token, gols_casa, gols_fora):
    """Tenta gravar/atualizar o palpite. Devolve o Response."""
    return requests.post(
        f"{PALPITES_URL}?on_conflict=participante_id,jogo_id",
        headers={
            **_headers(token),
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json={
            "participante_id": PARTICIPANTE_ID,
            "jogo_id": JOGO_ID_FECHADO,
            "gols_casa": gols_casa,
            "gols_fora": gols_fora,
        },
        timeout=TIMEOUT,
    )


def main():
    if "<" in ANON_KEY + EMAIL + SENHA + PARTICIPANTE_ID + JOGO_ID_FECHADO:
        print("Preencha os campos <...> no topo do arquivo antes de rodar.")
        sys.exit(1)

    token = login()
    original = ler_palpite(token)
    print(f"Palpite atual (conta lab): {original}")

    resp = escrever(token, GOLS_CASA, GOLS_FORA)
    aceitou = resp.status_code in (200, 201, 204)
    print(f"Escrita FORA do prazo -> HTTP {resp.status_code}")

    if aceitou:
        print(">> ACHADO: o servidor ACEITOU a escrita depois do prazo.")
        print("   A trava da 'janela de palpites' esta SO no front-end (Copa.js).")
        print("   Correcao no servidor: policy RLS ou trigger que rejeita")
        print("   INSERT/UPDATE em `palpites` apos o fechamento da fase.")
    elif resp.status_code in (401, 403):
        print(">> OK: o servidor BLOQUEOU (RLS/policy). Defesa server-side presente.")
    else:
        print(f">> Inconclusivo (HTTP {resp.status_code}): {resp.text[:200]}")

    # -- restaura o estado original: nao deixa lixo no banco --
    if aceitou:
        if original:
            back = escrever(token, original["gols_casa"], original["gols_fora"])
            print(f"Restaurado o palpite original -> HTTP {back.status_code}")
        else:
            d = requests.delete(
                f"{PALPITES_URL}?participante_id=eq.{PARTICIPANTE_ID}"
                f"&jogo_id=eq.{JOGO_ID_FECHADO}",
                headers=_headers(token),
                timeout=TIMEOUT,
            )
            print(f"Removido o palpite de teste (nao existia antes) -> HTTP {d.status_code}")


if __name__ == "__main__":
    main()
