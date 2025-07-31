const User = require('../models/User');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

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
    // Notificar al usuario seguido
    await Notification.create({
      user: targetId,
      type: 'follow',
      from: userId,
      message: 'Ha comenzado a seguirte'
    });
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

// Ver perfil por ID
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('followers', 'username avatar').populate('following', 'username avatar');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener perfil', error: error.message });
  }
};

// Ver perfil por username
exports.getProfileByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', 'username avatar')
      .populate('following', 'username avatar');
    
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    // Obtener los posts del usuario
    const Post = require('../models/Post');
    const posts = await Post.find({ user: user._id }).select('image caption createdAt likes');
    
    const profileData = {
      ...user.toObject(),
      posts: posts
    };
    
    res.json(profileData);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener perfil', error: error.message });
  }
};

// Sugerencias de usuarios a seguir (populares y aleatorios)
exports.getSuggestions = async (req, res) => {
  console.log('Entrando en getSuggestions');
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Excluir el propio usuario y los que ya sigue (convertir solo IDs válidos a ObjectId)
    const excludeIds = [userId, ...user.following]
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    console.log('excludeIds:', excludeIds);

    // 1. Buscar usuarios populares (más seguidores)
    let populares = [];
    try { // Added try-catch for aggregation
      populares = await User.aggregate([
        { $match: { _id: { $nin: excludeIds } } },
        { $addFields: { followersCount: { $size: "$followers" } } },
        { $sort: { followersCount: -1 } },
        { $limit: 5 }
      ]);
      console.log('populares:', populares); // Added log
    } catch (aggErr) {
      console.error('Error en agregación de populares:', aggErr); // Added log
      throw aggErr;
    }

    // Si hay menos de 5, completar con aleatorios
    let suggestions = populares;
    if (populares.length < 5) {
      const idsPopulares = populares.map(u => u._id);
      const faltan = 5 - populares.length;
      let aleatorios = [];
      try { // Added try-catch for aggregation
        aleatorios = await User.aggregate([
          { $match: { _id: { $nin: [...excludeIds, ...idsPopulares].filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } } }, // Ensure all IDs are valid ObjectIds
          { $sample: { size: faltan } }
        ]);
        console.log('aleatorios:', aleatorios); // Added log
      } catch (aggErr) {
        console.error('Error en agregación de aleatorios:', aggErr); // Added log
        throw aggErr;
      }
      suggestions = [...populares, ...aleatorios];
    }

    // Solo devolver los campos necesarios
    suggestions = suggestions.map(u => ({
      _id: u._id,
      username: u.username,
      avatar: u.avatar,
      bio: u.bio
    }));

    res.json(suggestions);
  } catch (error) {
    console.error('Error en getSuggestions:', error); // Added log
    res.status(500).json({ message: 'Error al obtener sugerencias', error: error.message });
  }
};
