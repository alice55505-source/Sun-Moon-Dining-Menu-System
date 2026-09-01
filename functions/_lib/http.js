export function json(data, init) {
  return new Response(JSON.stringify(data), {
    status: (init && init.status) || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorJson(message, status) {
  return json({ error: message }, { status: status || 400 });
}
