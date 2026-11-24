const linkService = require("../services/linkService");

const create = async (req, res) => {
  const link = await linkService.createLink(req.user, req.body);
  res.status(201).json(link);
};

const list = async (req, res) => {
  // Values were validated by the route; Express 5 makes req.query read-only,
  // so we parse here instead of using a sanitizer
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;

  res.json(await linkService.listLinks(req.user, { page, limit }));
};

const getOne = async (req, res) => {
  res.json(await linkService.getLink(req.user, Number(req.params.id)));
};

const update = async (req, res) => {
  const link = await linkService.updateLink(
    req.user,
    Number(req.params.id),
    req.body,
  );
  res.json(link);
};

const remove = async (req, res) => {
  await linkService.deleteLink(req.user, Number(req.params.id));
  res.status(204).send();
};

const redirect = async (req, res) => {
  const url = await linkService.redirectLink(req.params.code, {
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
    referrer: req.get("referer") || null,
  });

  res.redirect(url);
};

module.exports = {
  create,
  list,
  getOne,
  update,
  remove,
  redirect,
};
