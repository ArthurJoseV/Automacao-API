import { randomInt } from 'node:crypto';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

const usuarios = {
  admin: { email: 'admin@biblioteca.com', senha: 'Admin@123' },
  leitor: { email: 'leitor@biblioteca.com', senha: 'Leitor@123' },
};

type Perfil = keyof typeof usuarios;
type DetalheErro = { campo: string; mensagem: string };

export async function autenticar(request: APIRequestContext, perfil: Perfil) {
  const usuario = usuarios[perfil];
  const resposta = await request.post('/api/auth/login', { data: usuario });

  expect(resposta.status()).toBe(200);
  const login = await resposta.json();
  expect(login).toMatchObject({
    token: expect.any(String),
    tipo: 'Bearer',
    usuario: { email: usuario.email, perfil },
  });
  expect(login.token.length).toBeGreaterThan(0);

  return { Authorization: `Bearer ${login.token}` };
}

export function criarDadosLivro() {
  return {
    titulo: 'Livro de teste da Biblioteca',
    autor: 'Autor de Teste',
    // A API aceita ISBN com 13 dígitos; o valor aleatório reduz colisões entre execuções.
    isbn: randomInt(1_000_000_000_000, 10_000_000_000_000).toString(),
    anoPublicacao: 2020,
    quantidade: 2,
  };
}

export async function validarErro(
  resposta: APIResponse,
  status: number,
  erro: string,
  detalhes: DetalheErro[] = [],
) {
  expect(resposta.status()).toBe(status);
  expect(await resposta.json()).toEqual({ erro, detalhes, status });
}
