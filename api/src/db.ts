import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres:w0813BEhnuxLTkbhgch8N5enQagsMzQdcqE7PMaFBR2S1T1OMK49IPd5b8lJ494r@localhost:5432/postgres', {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export { sql };
