import { test, expect } from '@playwright/test';
import { autenticar, criarDadosLivro, validarErro } from './helpers/biblioteca';

test('Consultar o livro 1 retorna 200, título Dom Casmurro e disponível', async ({ request }) => {
  const resposta = await request.get('/api/livros/1');

  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toMatchObject({
    id: 1,
    titulo: 'Dom Casmurro',
    disponivel: true,
  });
});

test('Cadastrar livro como admin retorna 201 com os dados enviados e exclui ao final', async ({ request }) => {
  const headersAuth = await autenticar(request, 'admin');
  const dadosLivro = criarDadosLivro();
  const respostaCadastro = await request.post('/api/livros', {
    headers: headersAuth,
    data: dadosLivro,
  });

  // Guarda o id antes das asserções para que o finally também rode se elas falharem.
  const livroCriado = await respostaCadastro.json();
  try {
    expect(respostaCadastro.status()).toBe(201);
    expect(livroCriado).toMatchObject({
      ...dadosLivro,
      createdAt: expect.any(String),
      quantidadeDisponivel: dadosLivro.quantidade,
      disponivel: true,
    });
    expect(Number.isInteger(livroCriado.id)).toBe(true);
    expect(livroCriado.id).toBeGreaterThan(0);
  } finally {
    if (Number.isInteger(livroCriado.id) && livroCriado.id > 0) {
      const respostaExclusao = await request.delete(`/api/livros/${livroCriado.id}`, {
        headers: headersAuth,
      });
      expect(respostaExclusao.status()).toBe(204);
      expect(await respostaExclusao.text()).toBe('');

      const respostaConsulta = await request.get(`/api/livros/${livroCriado.id}`);
      await validarErro(respostaConsulta, 404, 'Livro não encontrado');
    }
  }
});

test('Cadastrar livro sem token retorna 401 e erro Token não informado', async ({ request }) => {
  const resposta = await request.post('/api/livros', { data: criarDadosLivro() });

  await validarErro(resposta, 401, 'Token não informado');
});

test('Emprestar Vidas Secas (livro 4) sem exemplares retorna 409 e erro Livro indisponível', async ({ request }) => {
  const headersAuth = await autenticar(request, 'leitor');
  const resposta = await request.post('/api/emprestimos', {
    headers: headersAuth,
    data: { livroId: 4 },
  });

  await validarErro(resposta, 409, 'Livro indisponível', [{
    campo: 'livroId',
    mensagem: 'Não há exemplares disponíveis deste livro no momento',
  }]);
});

test('Cadastrar livro com token de leitor retorna 403 por falta de permissão (extra)', async ({ request }) => {
  const headersAuth = await autenticar(request, 'leitor');
  const resposta = await request.post('/api/livros', {
    headers: headersAuth,
    data: criarDadosLivro(),
  });

  await validarErro(resposta, 403, 'Acesso negado: ação permitida apenas para o perfil admin');
});
