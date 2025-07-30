const Comment = require('../models/Comment');

// Añadir comentario a un post
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'El comentario no puede estar vacío' });
    const comment = new Comment({
      post: req.params.postId,
      user: req.user.id,
      text
    });
    await comment.save();
    res.status(201).json({ message: 'Comentario añadido', comment });
  } catch (error) {
    res.status(500).json({ message: 'Error al añadir comentario', error: error.message });
  }
};

// Listar comentarios de un post
exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('user', 'username avatar')
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener comentarios', error: error.message });
  }
};

// Eliminar comentario (solo el autor o el dueño del post)
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comentario no encontrado' });
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este comentario' });
    }
    await comment.deleteOne();
    res.json({ message: 'Comentario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar comentario', error: error.message });
  }
};
