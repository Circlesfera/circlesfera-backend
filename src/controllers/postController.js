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

// Dar/quitar like a un post
exports.toggleLike = async (req, res) => {
  try {
    const post = await require('../models/Post').findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    const userId = req.user.id;
    const index = post.likes.indexOf(userId);
    let liked;
    if (index === -1) {
      post.likes.push(userId);
      liked = true;
    } else {
      post.likes.splice(index, 1);
      liked = false;
    }
    await post.save();
    res.json({ liked, likesCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ message: 'Error al dar/quitar like', error: error.message });
  }
};

// Listar usuarios que han dado like a un post
exports.getLikes = async (req, res) => {
  try {
    const post = await require('../models/Post').findById(req.params.id).populate('likes', 'username avatar');
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    res.json(post.likes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener likes', error: error.message });
  }
};
