import json 
from urllib.request import Request, urlopen

url =

cpf = input("CPF: ")

for numero in range(10000):
    senha = f"{numero:04d}"


    dados = {
        "cpf": cpf,
        "senha": senha
    }

    corpo = json.dumps (dados).encode("utf-8")

    requisicao = Request(
        url,
        data=corpo,
        headers={"Content-Typer": "applicantion/json"},
        method="POST"
    )

    with urlopen(requisicao) as resposta:
        conteudo = conteudo.red