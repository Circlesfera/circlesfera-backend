import Report from '../models/Report.js'
import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import Story from '../models/Story.js'
import Comment from '../models/Comment.js'
import User from '../models/User.js'
import LiveStream from '../models/LiveStream.js'
import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import logger from '../utils/logger.js'
import { config } from '../utils/config.js'

// Crear un nuevo reporte
export const createReport = async (req, res) => {
  try {
    const { contentType, contentId, reason, description } = req.body
    const userId = req.userId

    // Verificar que el contenido existe
    let contentExists = false
    switch (contentType) {
      case 'post':
        contentExists = await Post.findById(contentId)
        break
      case 'reel':
        contentExists = await Reel.findById(contentId)
        break
      case 'story':
        contentExists = await Story.findById(contentId)
        break
      case 'comment':
        contentExists = await Comment.findById(contentId)
        break
      case 'user':
        contentExists = await User.findById(contentId)
        break
      case 'live_stream':
        contentExists = await LiveStream.findById(contentId)
        break
      case 'message':
        contentExists = await Message.findById(contentId)
        break
    }

    if (!contentExists) {
      return res.status(404).json({
        success: false,
        message: 'El contenido reportado no existe'
      })
    }

    // Verificar si el usuario ya reportó este contenido
    const existingReport = await Report.findOne({
      reportedBy: userId,
      contentType,
      contentId
    })

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'Ya has reportado este contenido'
      })
    }

    // Crear el reporte
    const report = new Report({
      reportedBy: userId,
      contentType,
      contentId,
      reason,
      description,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })

    await report.save()

    // Log para monitoreo
    logger.info('Reporte creado:', {
      reportId: report._id,
      userId,
      contentType,
      contentId,
      reason
    })

    res.status(201).json({
      success: true,
      message: 'Reporte enviado exitosamente. Lo revisaremos pronto.',
      report: {
        _id: report._id,
        contentType: report.contentType,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt
      }
    })
  } catch (error) {
    logger.error('Error en createReport:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener reportes (admin/moderador)
export const getReports = async (req, res) => {
  try {
    const {
      status = 'pending',
      contentType,
      reason,
      page = 1,
      limit = 20
    } = req.query

    const query = {}

    if (status) query.status = status
    if (contentType) query.contentType = contentType
    if (reason) query.reason = reason

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('reportedBy', 'username avatar fullName')
        .populate('reviewedBy', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(query)
    ])

    // Poblar el contenido reportado dinámicamente
    for (const report of reports) {
      let content = null
      switch (report.contentType) {
        case 'post':
          content = await Post.findById(report.contentId)
            .select('caption content user createdAt')
            .populate('user', 'username avatar')
            .lean()
          break
        case 'reel':
          content = await Reel.findById(report.contentId)
            .select('caption video user createdAt')
            .populate('user', 'username avatar')
            .lean()
          break
        case 'story':
          content = await Story.findById(report.contentId)
            .select('media user createdAt')
            .populate('user', 'username avatar')
            .lean()
          break
        case 'comment':
          content = await Comment.findById(report.contentId)
            .select('content user post createdAt')
            .populate('user', 'username avatar')
            .lean()
          break
        case 'user':
          content = await User.findById(report.contentId)
            .select('username avatar fullName bio')
            .lean()
          break
        case 'live_stream':
          content = await LiveStream.findById(report.contentId)
            .select('title description user createdAt')
            .populate('user', 'username avatar')
            .lean()
          break
        case 'message':
          content = await Message.findById(report.contentId)
            .select('content user createdAt')
            .populate('user', 'username avatar')
            .lean()
          break
      }

      report.reportedContent = content
    }

    res.json({
      success: true,
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    logger.error('Error en getReports:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener un reporte específico (admin/moderador)
export const getReportById = async (req, res) => {
  try {
    const { reportId } = req.params

    const report = await Report.findById(reportId)
      .populate('reportedBy', 'username avatar fullName email')
      .populate('reviewedBy', 'username avatar fullName')
      .lean()

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      })
    }

    // Poblar el contenido reportado
    let content = null
    switch (report.contentType) {
      case 'post':
        content = await Post.findById(report.contentId)
          .populate('user', 'username avatar fullName')
          .lean()
        break
      case 'reel':
        content = await Reel.findById(report.contentId)
          .populate('user', 'username avatar fullName')
          .lean()
        break
      case 'story':
        content = await Story.findById(report.contentId)
          .populate('user', 'username avatar fullName')
          .lean()
        break
      case 'comment':
        content = await Comment.findById(report.contentId)
          .populate('user', 'username avatar fullName')
          .lean()
        break
      case 'user':
        content = await User.findById(report.contentId)
          .select('username avatar fullName bio isActive')
          .lean()
        break
      case 'live_stream':
        content = await LiveStream.findById(report.contentId)
          .populate('user', 'username avatar fullName')
          .lean()
        break
      case 'message':
        content = await Message.findById(report.contentId)
          .populate('user', 'username avatar fullName')
          .lean()
        break
    }

    report.reportedContent = content

    res.json({
      success: true,
      report
    })
  } catch (error) {
    logger.error('Error en getReportById:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar estado de reporte (admin/moderador)
export const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params
    const { status, action, moderatorNotes } = req.body
    const moderatorId = req.userId

    const report = await Report.findById(reportId)

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      })
    }

    // Actualizar estado
    report.status = status
    report.reviewedBy = moderatorId
    report.reviewedAt = new Date()

    if (action) report.action = action
    if (moderatorNotes) report.moderatorNotes = moderatorNotes

    await report.save()

    // Ejecutar acción sobre el contenido si es necesario
    if (action && action !== 'none') {
      await executeModeractionAction(report.contentType, report.contentId, action)
    }

    // Notificar al usuario que reportó (opcional)
    if (status === 'resolved') {
      await Notification.create({
        user: report.reportedBy,
        type: 'system',
        message: 'Tu reporte ha sido revisado y resuelto. Gracias por ayudarnos a mantener la comunidad segura.',
        relatedContent: {
          type: 'report',
          id: report._id
        }
      })
    }

    logger.info('Reporte actualizado:', {
      reportId,
      moderatorId,
      status,
      action
    })

    res.json({
      success: true,
      message: 'Reporte actualizado exitosamente',
      report
    })
  } catch (error) {
    logger.error('Error en updateReportStatus:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener estadísticas de reportes (admin)
export const getReportStats = async (req, res) => {
  try {
    const stats = await Report.getReportStats()

    // Estadísticas por razón
    const reasonStats = await Report.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    // Estadísticas por tipo de contenido
    const contentTypeStats = await Report.aggregate([
      {
        $group: {
          _id: '$contentType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    res.json({
      success: true,
      stats: {
        byStatus: stats,
        byReason: reasonStats,
        byContentType: contentTypeStats
      }
    })
  } catch (error) {
    logger.error('Error en getReportStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Función auxiliar para ejecutar acciones de moderación
async function executeModeractionAction(contentType, contentId, action) {
  try {
    switch (action) {
      case 'content_removed':
        // Soft delete del contenido
        switch (contentType) {
          case 'post':
            await Post.findByIdAndUpdate(contentId, { isDeleted: true })
            break
          case 'reel':
            await Reel.findByIdAndUpdate(contentId, { isDeleted: true })
            break
          case 'story':
            await Story.findByIdAndUpdate(contentId, { isDeleted: true })
            break
          case 'comment':
            await Comment.findByIdAndUpdate(contentId, { isDeleted: true })
            break
        }
        break

      case 'user_banned':
      case 'user_suspended':
        // Desactivar usuario (implementar lógica según necesidades)
        if (contentType === 'user') {
          await User.findByIdAndUpdate(contentId, {
            isActive: false,
            suspensionReason: action === 'user_banned' ? 'banned' : 'suspended'
          })
        }
        break
    }
  } catch (error) {
    logger.error('Error ejecutando acción de moderación:', error)
  }
}

