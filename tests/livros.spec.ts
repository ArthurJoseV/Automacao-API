import { randomInt } from 'node:crypto';
import { test, expect } from '@playwright/test';

const admin = {
  email: 'admin@biblioteca.com',
  senha: 'Admin@123',
};

const leitor = {
  email: 'leitor@biblioteca.com',
  senha: 'Leitor@123',
};

const dadosLivro = {
  titulo: 'Livro de teste da Biblioteca',
  autor: 'Autor de Teste',
  // A API aceita ISBN com 13 dígitos; o valor aleatório evita colisões entre execuções.
  isbn: randomInt(1_000_000_000_000, 10_000_000_000_000).toString(),
  anoPublicacao: 2020,
  quantidade: 2,
};

test('Consultar o livro 1 retorna 200, título Dom Casmurro e disponível', async ({ request }) => {
  const resposta = await request.get('/api/livros/1');

  expect(resposta.status()).toBe(200);
  const corpo = await resposta.json();
  expect(corpo.titulo).toBe('Dom Casmurro');
  expect(corpo.disponivel).toBe(true);
});

test('Cadastrar livro como admin retorna 201 com os dados enviados e exclui ao final', async ({ request }) => {
  const respostaLogin = await request.post('/api/auth/login', { data: admin });
  expect(respostaLogin.status()).toBe(200);
  const login = await respostaLogin.json();
  expect(login.token).toEqual(expect.any(String));
  expect(login.token.length).toBeGreaterThan(0);
  expect(login.tipo).toBe('Bearer');
  expect(login.usuario).toMatchObject({ email: admin.email, perfil: 'admin' });

  const headersAuth = { Authorization: `Bearer ${login.token}` };
  const respostaCadastro = await request.post('/api/livros', {
    headers: headersAuth,
    data: dadosLivro,
  });

  // Guarda o id antes das asserções para que o finally também rode se elas falharem.
  const livroCriado = await respostaCadastro.json();
  try {
    expect(respostaCadastro.status()).toBe(201);
    expect(livroCriado).toMatchObject(dadosLivro);
    expect(Number.isInteger(livroCriado.id)).toBe(true);
    expect(livroCriado.id).toBeGreaterThan(0);
    expect(livroCriado.createdAt).toEqual(expect.any(String));
    expect(livroCriado.quantidadeDisponivel).toBe(dadosLivro.quantidade);
    expect(livroCriado.disponivel).toBe(true);
  } finally {
    if (Number.isInteger(livroCriado.id) && livroCriado.id > 0) {
      const respostaExclusao = await request.delete(`/api/livros/${livroCriado.id}`, {
        headers: headersAuth,
      });
      expect(respostaExclusao.status()).toBe(204);
      expect(await respostaExclusao.text()).toBe('');

      const respostaConsulta = await request.get(`/api/livros/${livroCriado.id}`);
      expect(respostaConsulta.status()).toBe(404);
      expect(await respostaConsulta.json()).toEqual({
        erro: 'Livro não encontrado',
        detalhes: [],
        status: 404,
      });
    }
  }
});

test('Cadastrar livro sem token retorna 401 e erro Token não informado', async ({ request }) => {
  const resposta = await request.post('/api/livros', { data: dadosLivro });

  expect(resposta.status()).toBe(401);
  expect(await resposta.json()).toEqual({
    erro: 'Token não informado',
    detalhes: [],
    status: 401,
  });
});

test('Emprestar Vidas Secas (livro 4) sem exemplares retorna 409 e erro Livro indisponível', async ({ request }) => {
  const respostaLogin = await request.post('/api/auth/login', { data: leitor });
  expect(respostaLogin.status()).toBe(200);
  const login = await respostaLogin.json();
  expect(login.token).toEqual(expect.any(String));
  expect(login.token.length).toBeGreaterThan(0);
  expect(login.usuario).toMatchObject({ email: leitor.email, perfil: 'leitor' });

  const resposta = await request.post('/api/emprestimos', {
    headers: { Authorization: `Bearer ${login.token}` },
    data: { livroId: 4 },
  });

  expect(resposta.status()).toBe(409);
  expect(await resposta.json()).toEqual({
    erro: 'Livro indisponível',
    detalhes: [{
      campo: 'livroId',
      mensagem: 'Não há exemplares disponíveis deste livro no momento',
    }],
    status: 409,
  });
});

test('Cadastrar livro com token de leitor retorna 403 por falta de permissão (extra)', async ({ request }) => {
  const respostaLogin = await request.post('/api/auth/login', { data: leitor });
  expect(respostaLogin.status()).toBe(200);
  const login = await respostaLogin.json();
  expect(login.token).toEqual(expect.any(String));
  expect(login.token.length).toBeGreaterThan(0);
  expect(login.usuario).toMatchObject({ email: leitor.email, perfil: 'leitor' });

  const resposta = await request.post('/api/livros', {
    headers: { Authorization: `Bearer ${login.token}` },
    data: dadosLivro,
  });

  expect(resposta.status()).toBe(403);
  expect(await resposta.json()).toEqual({
    erro: 'Acesso negado: ação permitida apenas para o perfil admin',
    detalhes: [],
    status: 403,
  });
});
