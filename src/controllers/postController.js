const Post = require('../models/Post');
const Notification = require('../models/Notification');

exports.createPost = async (req, res) => {
  try {
    console.log('=== CREATE POST DEBUG ===');
    console.log('User ID:', req.user.id);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    
    const { type, caption } = req.body;
    
    let postData = {
      user: req.user.id,
      type: type || 'image',
      caption: caption || ''
    };

    console.log('Post data before switch:', postData);

    // Manejar diferentes tipos de contenido
    switch (type) {
      case 'image':
        if (!req.file) {
          console.log('ERROR: No file provided for image post');
          return res.status(400).json({ message: 'La imagen es obligatoria para publicaciones de imagen' });
        }
        postData.content = { image: `/uploads/${req.file.filename}` };
        console.log('Image post data:', postData);
        break;

      case 'video':
        if (!req.file) {
          console.log('ERROR: No file provided for video post');
          return res.status(400).json({ message: 'El video es obligatorio para publicaciones de video' });
        }
        // Aquí podrías procesar el video para obtener duración y thumbnail
        // Por ahora usamos valores por defecto
        postData.content = {
          video: {
            url: `/uploads/${req.file.filename}`,
            duration: 0, // Se calcularía con ffmpeg
            thumbnail: `/uploads/${req.file.filename.replace(/\.[^/.]+$/, '_thumb.jpg')}`
          }
        };
        console.log('Video post data:', postData);
        break;

      default:
        console.log('ERROR: Invalid post type:', type);
        return res.status(400).json({ message: 'Tipo de publicación no válido' });
    }

    console.log('Creating post with data:', postData);
    const post = new Post(postData);
    await post.save();
    console.log('Post saved successfully:', post._id);
    
    // Populate user data for response
    await post.populate('user', 'username avatar');
    console.log('Post populated successfully');
    
    res.status(201).json({ message: 'Post creado correctamente', post });
  } catch (error) {
    console.error('ERROR in createPost:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Error al crear el post', error: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const { type } = req.query;
    let query = {};
    
    if (type && ['image', 'video'].includes(type)) {
      query.type = type;
    }

    const posts = await Post.find(query)
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
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    const userId = req.user.id;
    const index = post.likes.indexOf(userId);
    let liked;
    if (index === -1) {
      post.likes.push(userId);
      liked = true;
      // Notificar al dueño del post si no es el mismo usuario
      if (post.user.toString() !== userId) {
        await Notification.create({
          user: post.user,
          type: 'like',
          from: userId,
          post: post._id,
          message: 'Le ha gustado tu publicación'
        });
      }
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
    const post = await Post.findById(req.params.id).populate('likes', 'username avatar');
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    res.json(post.likes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener likes', error: error.message });
  }
};

// Obtener el feed de publicaciones de usuarios seguidos y propio usuario
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Usuarios a mostrar: seguidos + propio usuario
    const usersToShow = [userId, ...user.following];

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ user: { $in: usersToShow } })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ user: { $in: usersToShow } });

    res.json({ posts, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el feed', error: error.message });
  }
};

// Obtener un post específico
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username avatar')
      .populate('likes', 'username avatar');
    
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Incrementar vistas
    post.views += 1;
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el post', error: error.message });
  }
};

// Eliminar un post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Verificar que el usuario sea el dueño del post
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el post', error: error.message });
  }
};
