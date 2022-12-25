const testRoute = (req, res) => {
   res.status(200).send({
      message: 'woooooo'
   });
}

exports.testRoute = testRoute;