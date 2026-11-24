const authService = require("../services/authService");

const register = async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ message: "User created successfully", user });
};

const login = async (req, res) => {
  const token = await authService.login(req.body);
  res.json({ message: "Login successful", token });
};

module.exports = { register, login };
