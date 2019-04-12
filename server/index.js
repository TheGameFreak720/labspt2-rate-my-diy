const path = require('path');
const { GraphQLServer } = require('graphql-yoga');
const { makePrismaSchema, prismaObjectType } = require('nexus-prisma');
const { unionType } = require('nexus');
const { prisma } = require('./src/generated/prisma-client');
const datamodelInfo = require('./src/generated/nexus-prisma');
const { stripe } = require('./src/stripe');
const { stringArg, idArg, intArg } = require('nexus');
const nodemailer = require('nodemailer');
const pug = require('pug');

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ratemydiyproject@gmail.com', // generated ethereal user
    pass: 'lambda123' // generated ethereal password
  }
});

const Query = prismaObjectType({
  name: 'Query',
  definition(t) {
    t.prismaFields(['*']);
  }
});
const Mutation = prismaObjectType({
  name: 'Mutation',
  definition(t) {
    t.prismaFields(['*']);
    t.field('dislikeAReview', {
      type: 'Review',
      args: {
        id: idArg(),
        username: stringArg()
      },
      resolve: async (parent, { id, username }, ctx, info) => {
        const review = await prisma.review({ id: id });
        let thumbsDown = review.thumbsDown;
        thumbsDown += 1;

        const updatedReview = await prisma.updateReview({
          data: { thumbsDown },
          where: { id: id }
        });

        const user = await prisma.updateUser({
          data: { DisLikedReviews: { connect: { id } } },
          where: { username: username }
        });

        return updatedReview;
      }
    });
    t.field('likeAReview', {
      type: 'Review',
      args: {
        id: idArg(),
        username: stringArg()
      },
      resolve: async (parent, { id, username }, ctx, info) => {
        const review = await prisma.review({ id: id });
        let thumbsUp = review.thumbsUp;
        thumbsUp += 1;

        const updatedReview = await prisma.updateReview({
          data: { thumbsUp },
          where: { id: id }
        });

        const user = await prisma.updateUser({
          data: { LikedReviews: { connect: { id } } },
          where: { username: username }
        });

        return updatedReview;
      }
    });
    t.field('rateAProject', {
      type: 'Project',
      args: {
        rating: intArg(),
        id: idArg(),
        username: stringArg()
      },
      resolve: async (parent, { rating, id, username }, ctx, info) => {
        const project = await prisma.project({ id: id });
        let ratings = project.rating;
        ratings.push(rating);

        const updatedProject = await prisma.updateProject({
          data: { rating: ratings },
          where: { id }
        });

        const user = await prisma.updateUser({
          data: { RatedProjects: { connect: { id } } },
          where: { username }
        });

        return updatedProject;
      }
    });
    t.field('newUser', {
      type: 'User',
      args: {
        username: stringArg(),
        email: stringArg()
      },
      resolve: async (parent, { username, email }, ctx, info) => {
        const compiledFunction = pug.compileFile('./templates/newUser.pug');
        const template = compiledFunction({
          name: username
        });
        mailOptions = {
          from: 'ratemydiyproject@gmail.com', // sender address
          to: email, // list of receivers
          subject: 'Welcome to Rate My DIY!', // Subject line
          html: template // plain text body
        };

        let user = await prisma.createUser({
          username,
          email
        });
        await transporter.sendMail(mailOptions, function(err, info) {
          if (err) console.log(err);
          else console.log(info);
        });
        return user;
      }
    });
    t.field('newReview', {
      type: 'Review',
      args: {
        name: stringArg(),
        text: stringArg(),
        timestamp: stringArg(),
        user: stringArg(),
        username: stringArg(),
        id: idArg()
      },
      resolve: async (
        parent,
        { name, text, timestamp, username, user, id },
        ctx,
        info
      ) => {
        let project = await prisma.project({ id: id });
        let projectAuthor = await prisma.user({ username: user });
        const compiledFunction = pug.compileFile('./templates/newReview.pug');
        const template = compiledFunction({
          name: project.name
        });

        mailOptions = {
          from: 'ratemydiyproject@gmail.com', // sender address
          to: projectAuthor.email, // list of receivers
          subject: 'Your project has a new review!', // Subject line
          html: template // plain text body
        };

        let review = await prisma.createReview({
          name,
          text,
          timestamp,
          Author: {
            connect: { username }
          },
          ProjectReviewed: {
            connect: { id }
          }
        });
        await transporter.sendMail(mailOptions, function(err, info) {
          if (err) console.log(err);
          else console.log(info);
        });
        return review;
      }
    });
    t.field('newProject', {
      type: 'Project',
      args: {
        name: stringArg(),
        category: stringArg(),
        timestamp: stringArg(),
        titleImg: stringArg(),
        titleBlurb: stringArg(),
        steps: stringArg(),
        username: stringArg()
      },
      resolve: (
        parent,
        { name, category, timestamp, titleImg, titleBlurb, steps, username },
        ctx,
        info
      ) => {
        return prisma.createProject({
          name,
          category,
          timestamp,
          titleImg,
          titleBlurb,
          steps,
          rating: { set: [1] },
          User: { connect: { username } }
        });
      }
    });
    t.field('editProject', {
      type: 'Project',
      args: {
        name: stringArg(),
        category: stringArg(),
        timestamp: stringArg(),
        titleImg: stringArg(),
        titleBlurb: stringArg(),
        steps: stringArg(),
        username: stringArg(),
        id: stringArg()
      },
      resolve: (
        parent,
        {
          name,
          category,
          timestamp,
          titleImg,
          titleBlurb,
          steps,
          username,
          id
        },
        ctx,
        info
      ) => {
        return prisma.updateProject({
          data: {
            name,
            category,
            timestamp,
            titleImg,
            titleBlurb,
            steps,
            User: { connect: { username } }
          },
          where: { id: id }
        });
      }
    });
    t.field('firebaseSignUp', {
      type: 'User',
      args: {
        username: stringArg(),
        email: stringArg(),
        thirdPartyUID: stringArg()
      },
      resolve: async (
        parent,
        { username, email, thirdPartyUID },
        ctx,
        info
      ) => {
        const compiledFunction = pug.compileFile('./templates/newUser.pug');
        const template = compiledFunction({
          name: username
        });
        mailOptions = {
          from: 'ratemydiyproject@gmail.com', // sender address
          to: email, // list of receivers
          subject: 'Welcome to Rate My DIY!', // Subject line
          html: template // plain text body
        };

        let user = await prisma.createUser({
          username,
          email,
          thirdPartyUID
        });
        await transporter.sendMail(mailOptions, function(err, info) {
          if (err) console.log(err);
          else console.log(info);
        });
        return user;
      }
    });
    t.field('createSubscription', {
      type: 'User',
      args: {
        source: stringArg(),
        email: stringArg()
      },
      resolve: async (parent, args, { req }, info) => {
        const customer = await stripe.customers.create({
          email: args.email,
          source: args.source,
          plan: 'plan_EgOcH41cdoNcdA'
        });

        const updatingUser = await prisma.updateUser({
          where: { email: args.email },
          data: {
            stripeId: customer.id,
            accountType: 'standard-tier'
          }
        });
        const updatedUser = await prisma.user({ email: args.email });

        return updatedUser;
      }
    });
  }
});

const schema = makePrismaSchema({
  types: [Query, Mutation],

  prisma: {
    datamodelInfo,
    client: prisma
  },

  outputs: {
    schema: path.join(
      __dirname,
      './src/generated/prisma-client/schema.graphql'
    ),
    typegen: path.join(__dirname, './src/generated/nexus.js')
  }
});

const server = new GraphQLServer({
  schema,
  context: { prisma },
  debug: true
});
server.start(() => console.log(`Server is running on http://localhost:4000`));
