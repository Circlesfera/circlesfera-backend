const User = require('../models/User');

// Seguir usuario
exports.followUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = req.params.id;
    if (userId === targetId) return res.status(400).json({ message: 'No puedes seguirte a ti mismo' });
    const user = await User.findById(userId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (target.followers.includes(userId)) return res.status(400).json({ message: 'Ya sigues a este usuario' });
    target.followers.push(userId);
    user.following.push(targetId);
    await target.save();
    await user.save();
    res.json({ message: 'Ahora sigues a ' + target.username });
  } catch (error) {
    res.status(500).json({ message: 'Error al seguir usuario', error: error.message });
  }
};

// Dejar de seguir usuario
exports.unfollowUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = req.params.id;
    if (userId === targetId) return res.status(400).json({ message: 'No puedes dejar de seguirte a ti mismo' });
    const user = await User.findById(userId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (!target.followers.includes(userId)) return res.status(400).json({ message: 'No sigues a este usuario' });
    target.followers = target.followers.filter(f => f.toString() !== userId);
    user.following = user.following.filter(f => f.toString() !== targetId);
    await target.save();
    await user.save();
    res.json({ message: 'Has dejado de seguir a ' + target.username });
  } catch (error) {
    res.status(500).json({ message: 'Error al dejar de seguir usuario', error: error.message });
  }
};

// Ver seguidores
exports.getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'username avatar');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user.followers);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener seguidores', error: error.message });
  }
};

// Ver seguidos
exports.getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'username avatar');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user.following);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener seguidos', error: error.message });
  }
};

// Ver perfil
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('followers', 'username avatar').populate('following', 'username avatar');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener perfil', error: error.message });
  }
};
