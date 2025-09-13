export default async function handler(req, res) {
  const base = !!process.env.GB_API_BASE;
  const key  = !!process.env.GB_API_KEY;
  // NÃO exponha valores; só diga se existem
  res.status(200).json({
    ok: true,
    has_GB_API_BASE: base,
    has_GB_API_KEY: key
  });
}
