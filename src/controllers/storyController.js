const Story = require('../models/Story');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Crear story
exports.createStory = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'La imagen es obligatoria' });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const story = new Story({
      user: req.user.id,
      image: `/uploads/${req.file.filename}`,
      expiresAt
    });
    await story.save();
    // Notificar a todos los seguidores
    const user = await User.findById(req.user.id);
    if (user.followers && user.followers.length > 0) {
      await Promise.all(user.followers.map(followerId =>
        Notification.create({
          user: followerId,
          type: 'story',
          from: req.user.id,
          story: story._id,
          message: 'Ha subido una nueva historia'
        })
      ));
    }
    res.status(201).json({ message: 'Story creada', story });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear story', error: error.message });
  }
};

// Listar stories de seguidos y propio usuario (no expiradas)
exports.getStories = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const usersToShow = [req.user.id, ...user.following];
    const now = new Date();
    const stories = await Story.find({
      user: { $in: usersToShow },
      expiresAt: { $gt: now }
    }).populate('user', 'username avatar').sort({ createdAt: -1 });
    res.json(stories);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener stories', error: error.message });
  }
};

// Eliminar story (solo el autor)
exports.deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story no encontrada' });
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta story' });
    }
    await story.deleteOne();
    res.json({ message: 'Story eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar story', error: error.message });
  }
};
