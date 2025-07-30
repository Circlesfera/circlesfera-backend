const Post = require('../models/Post');

exports.createPost = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'La imagen es obligatoria' });
    }
    const { caption } = req.body;
    const post = new Post({
      user: req.user.id,
      image: `/uploads/${req.file.filename}`,
      caption: caption || ''
    });
    await post.save();
    res.status(201).json({ message: 'Post creado correctamente', post });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear el post', error: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los posts', error: error.message });
  }
};
