const express = require("express");
const { Transform } = require("json2csv");
const { pipeline } = require("stream");
const { join } = require("path");
const { createReadStream } = require("fs-extra");
const { getAttendees, writeAttendees } = require("../../fsUtilites");
const { check, validationResult } = require("express-validator");
const pdfmake = require("pdfmake");
const uniqid = require("uniqid");
const sgMail = require("@sendgrid/mail");
var fs = require("fs");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const fonts = {
  Roboto: {
    normal: "fonts/Roboto-Regular.ttf",
    bold: "fonts/Roboto-Medium.ttf",
    italics: "fonts/Roboto-Italic.ttf",
    bolditalics: "fonts/Roboto-MediumItalic.ttf",
  },
};
const pdfFile = new pdfmake(fonts);

const attendRouter = express.Router();

attendRouter.get("/", async (req, res, next) => {
  try {
    const attendees = await getAttendees();
    res.send(attendees);
  } catch (error) {
    console.log(error);
    next(error);
  }
});
attendRouter.post(
  "/",
  check("name").isLength({ min: 4 }).withMessage("No way! Name too short!").exists().withMessage("Insert a name please!"),
  check("surname").isLength({ min: 4 }).withMessage("No way! Surname too short!").exists().withMessage("Insert a surname please!"),
  check("email").isEmail().withMessage("No way! Email not correct!").exists().withMessage("Insert an email please!"),
  check("timeOfArrival").exists().withMessage("Please insert Time of Arrival please!"),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const err = new Error();
        err.message = errors;
        err.httpStatusCode = 400;
        next(err);
      } else {
        const attendees = await getAttendees();
        const newAttendee = {
          ID: uniqid(),
          ...req.body,
        };
        attendees.push(newAttendee);
        await writeAttendees(attendees);
        res.status(201).send(newAttendee);
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);
attendRouter.delete("/:id", async (req, res, next) => {
  try {
    const attendees = await getAttendees();
    const filterdAttendees = attendees.filter((student) => student.ID !== req.params.id);
    writeAttendees(filterdAttendees);
    res.status(201).send("Attendee will no longer be partecipating event");
  } catch (error) {
    next(error);
  }
});
attendRouter.get("/csv", async (req, res, next) => {
  try {
    const path = join(__dirname, "attendees.json");
    const jsonReadableStream = createReadStream(path);

    const json2csv = new Transform({
      fields: ["ID", "name", "surname", "email", "timeofArrival"],
    });

    res.setHeader("Content-Disposition", "attachment; filename=EventAttendees.csv");
    pipeline(jsonReadableStream, json2csv, res, (err) => {
      if (err) {
        console.log(err);
        next(err);
      } else {
        console.log("Done");
      }
    });
  } catch (error) {
    next(error);
  }
});
attendRouter.post("/export/:id/createPDF", async (req, res, next) => {
  try {
    const attendees = await getAttendees();
    const attendee = attendees.find((student) => student.ID === req.params.id);
    var docDefinition = {
      header: { text: "Event Confirmation", fontSize: 22, bold: true },

      footer: {
        columns: ["Thank you for booking with us! ", { text: "See you at th event", alignment: "right" }],
      },
      content: [
        "ID of the attendee " + { text: attendee.ID, bold: true },
        { text: "Attendee Details", fontSize: 18 },
        {
          alignment: "justify",
          columns: [
            {
              width: "30%",
              text: "Name",
            },
            {
              text: attendee.name,
            },
          ],
        },
        {
          alignment: "justify",
          columns: [
            {
              width: "30%",
              text: "Surname",
            },
            {
              text: attendee.surname,
            },
          ],
        },
        {
          alignment: "justify",
          columns: [
            {
              width: "30%",
              text: "Email",
            },
            {
              text: attendee.Email,
            },
          ],
        },
        {
          alignment: "justify",
          columns: [
            {
              width: "30%",
              text: "Arrival Time",
            },
            {
              text: attendee.timeOfArrival,
            },
          ],
        },
      ],
    };
    const pdfDoc = pdfFile.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Disposition", "attachment; filename=EventAttendees.pdf");
  } catch (error) {
    next(error);
  }
});
///Email
attendRouter.post("/email/:id/", async (req, res, next) => {
  const attendees = await getAttendees();
  const attendee = attendees.find((student) => student.ID === req.params.id);
  const msg = {
    to: attendee.email, // Change to your recipient
    from: "vanecattabiani@gmail.com", // Change to your verified sender
    subject: "Confirmetion for booking an Event",
    text: "Thank you for booking with us",
    html: "<strong>Thank you for booking with us!!!</strong>",
  };
  console.log(attendee.email);
  sgMail
    .send(msg)
    .then(() => {
      res.status(201).send("Email sent");
    })
    .catch((error) => {
      next(error);
    });
});
module.exports = attendRouter;
