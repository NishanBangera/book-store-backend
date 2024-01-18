const Procurement = require('../models/procurement-model')
const Address = require('../models/address-model')
const Product = require('../models/product-model')
const _ = require('lodash')
const transporter = require('../../config/nodemailer')


const procurementCltr = {}

procurementCltr.create = async(req,res) =>{
    // const {sellerId} = req.params
    const body = req.body
    //console.log('hello',body)
    try{
        const address = await Address.findOne({_id:body.address})
        const [long,lat] = address.location.coordinates
        console.log('test',long,lat)
        const nearAdd = await Address.aggregate([
            {
                $geoNear: {
                    near : {type:'Point', coordinates : [long,lat]},
                    key : 'location',
                    distanceField: "dist.calculated",
                    // spherical:true
                }    
            },
            {
                $lookup: {
                    from: 'users', // Replace 'users' with the name of the User collection
                    localField: 'userId',
                    foreignField: '_id',
                    as:'user'
                }
            },
        ])
        const findModerator = nearAdd.find(ele=>ele.user[0].role === 'moderator')
        console.log(findModerator.user[0].email)
        const procurement = new Procurement(body)
        procurement.seller = req.user.id
        procurement.buyer = findModerator.userId

        if(findModerator.user[0].email){
            const info = await transporter.sendMail({
                from: `Shrikant Shivangi ${process.env.NODE_MAILER_MAIL}`, // sender address
                to : `${findModerator.user[0].email}`,
                subject : "Procuring Item",
                text : `We have successfully recieved your procurement request.`,
                html : "<b>We have successfully recieved your procurement request.</b>"

            })
        }

        const savedProcurement = await procurement.save()
        const findProcurement = await Procurement.findById(savedProcurement._id).populate('products.product')
        res.json(findProcurement)
    }
    catch(e){
        console.log('err',e)
        res.status(500).json(e)
    }
}

procurementCltr.list = async(req,res) => {
    try {
        if(req.user.role === 'user'){
            console.log(req.user.role)
            const sellerProc = await Procurement.find({ seller : req.user.id }).populate('products.product')
            if(!sellerProc.length === 0){
                res.status(404).json({ error : [{msg : 'Procured Items Not Found'}] })
            }
            res.json(sellerProc)
        }else if(req.user.role === 'moderator'){
            const procurement = await Procurement.find({ buyer : req.user.id }).populate('products.product')
            res.json(procurement)
        }
        else{
            const items = await Procurement.find().populate('products.product')
            res.json(items)
        }
        //console.log('pc',procurement)
    } catch (e) {
        res.status(500).json(e)
    }
}

procurementCltr.updateStatus= async(req,res) => {
    const id = req.params.procurementId
    try{
        const procurement = await Procurement.findOneAndUpdate({ _id : id }, {status : 'Procured' },{new:true})
        procurement.products.map(async(ele)=>{
            await Product.findByIdAndUpdate(ele.product,{$inc: {stockCount : ele.quantity }})
        })
        res.json(procurement)
    } catch(e){
        res.status(500).json(e)
    }
}

procurementCltr.cancel = async(req,res) => {
    const id = req.params.procurementId
    try {
        const items = await Procurement.findOneAndDelete({ _id : id })
        res.json(items)
    } catch (e) {
        res.status(500).json(e)
    }
}

// procurementCltr.listAll = async(req,res) => {
//     try {
        
//     } catch (e) {
//         res.status(500).json(e)
//     }
// }

module.exports = procurementCltr