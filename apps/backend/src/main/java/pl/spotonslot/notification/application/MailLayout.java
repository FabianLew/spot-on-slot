package pl.spotonslot.notification.application;

import org.springframework.web.util.HtmlUtils;

/**
 * The web app's arcade look for e-mails: a dark card in a yellow frame under a red pixel stripe, pixel labels and a
 * red button, in table-based HTML with inline styles. Silkscreen and Space Mono load where the client allows web
 * fonts (Apple Mail, iOS); elsewhere the monospace fallback keeps the feel. Every method takes text that is still
 * to be escaped, except the {@code ...Html} arguments, which are markup built here.
 */
final class MailLayout {

    static final String PIXEL = "font-family:'Silkscreen','Courier New',Courier,monospace;";
    static final String MONO = "font-family:'Space Mono','Courier New',Courier,monospace;";
    static final String YELLOW = "#ffd400";
    static final String RED = "#ff261f";

    /** The pixel stripe at the top of the card: red and black squares, like the app's sidebar. */
    private static final String STRIPE = "<table role=\"presentation\" width=\"100%%\" cellpadding=\"0\" "
            + "cellspacing=\"0\" style=\"border-collapse:collapse;\"><tr>"
            + ("<td height=\"6\" style=\"height:6px;line-height:6px;font-size:0;background:" + RED
            + ";\">&nbsp;</td><td height=\"6\" style=\"height:6px;line-height:6px;font-size:0;background:#0a0a0a;\">"
            + "&nbsp;</td>").repeat(16)
            + "</tr></table>";

    private static final String PAGE = """
            <!DOCTYPE html>
            <html lang="%s">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="dark">
            <meta name="supported-color-schemes" content="dark">
            <link href="https://fonts.googleapis.com/css2?family=Silkscreen&amp;family=Space+Mono:wght@400;700&amp;display=swap" rel="stylesheet">
            <title>%s</title>
            </head>
            <body style="margin:0;padding:0;background:#0a0a0a;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%s</div>
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
            <tr><td align="center" style="padding:28px 12px;">
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr><td style="padding:0 0 16px;PIXEL_font-size:20px;line-height:20px;letter-spacing:2px;\
            color:YELLOW_;">SPOT<br>ON<br>SLOT</td></tr>
            <tr><td style="background:#141414;border:2px solid YELLOW_;">
            STRIPE_
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">%s</table>
            </td></tr>
            <tr><td style="padding:20px 4px 0;MONO_font-size:12px;line-height:18px;color:#8a8a8a;">%s\
            <p style="margin:0;PIXEL_font-size:11px;letter-spacing:1px;color:#5c5c5c;">%s</p>
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            """.replace("PIXEL_", PIXEL).replace("MONO_", MONO).replace("YELLOW_", YELLOW)
            .replace("STRIPE_", STRIPE);

    private MailLayout() {
    }

    /**
     * A whole e-mail.
     *
     * @param sectionsHtml rows of the card ({@link #section}), top to bottom
     * @param footerHtml   paragraphs under the card ({@link #footnote}, {@link #links})
     * @param tagline      the last line, in pixel type
     */
    static String page(String language, String title, String preheader, String sectionsHtml, String footerHtml,
            String tagline) {
        return PAGE.formatted(escape(language), escape(title), escape(preheader), sectionsHtml, footerHtml,
                escape(tagline));
    }

    /** One row of the card; the first should be {@link #intro}, the last end with a button. */
    static String section(String contentHtml, String padding) {
        return "<tr><td style=\"padding:" + padding + ";\">" + contentHtml + "</td></tr>";
    }

    /** The card's head: a yellow tag, a large title and a lead paragraph. */
    static String intro(String kicker, String title, String lead) {
        return section("<span style=\"display:inline-block;padding:5px 10px;background:" + YELLOW
                + ";color:#0a0a0a;" + PIXEL + "font-size:12px;letter-spacing:1px;text-transform:uppercase;\">"
                + escape(kicker) + "</span>"
                + "<h1 style=\"margin:18px 0 8px;" + MONO + "font-size:24px;line-height:30px;font-weight:bold;"
                + "color:#ffffff;\">" + escape(title) + "</h1>"
                + "<p style=\"margin:0;" + MONO + "font-size:15px;line-height:22px;color:#c8c8c8;\">"
                + escape(lead) + "</p>", "28px 24px 8px");
    }

    static String paragraph(String text) {
        return "<p style=\"margin:0 0 12px;" + MONO + "font-size:15px;line-height:22px;color:#f2f2f2;\">"
                + escape(text) + "</p>";
    }

    /** The red button with a yellow pixel shadow, as the card's last row. */
    static String button(String href, String label) {
        return section("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
                + "<td style=\"background:" + RED + ";border:2px solid #0a0a0a;box-shadow:4px 4px 0 " + YELLOW
                + ";\"><a href=\"" + escape(href) + "\" style=\"display:inline-block;padding:14px 22px;" + PIXEL
                + "font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#0a0a0a;"
                + "text-decoration:none;\">" + escape(label) + " &rarr;</a></td></tr></table>", "24px 24px 28px");
    }

    /** Small text under the card. */
    static String footnote(String text) {
        return "<p style=\"margin:0 0 12px;\">" + escape(text) + "</p>";
    }

    /** The link spelled out under the card, for clients where the button does not work. */
    static String fallbackLink(String label, String href) {
        return "<p style=\"margin:0 0 12px;word-break:break-all;\">" + escape(label) + "<br><a href=\""
                + escape(href) + "\" style=\"color:#f2f2f2;\">" + escape(href) + "</a></p>";
    }

    /** Two links side by side under the card. */
    static String links(String firstHref, String first, String secondHref, String second) {
        return "<p style=\"margin:0 0 12px;\"><a href=\"" + escape(firstHref) + "\" style=\"color:#f2f2f2;\">"
                + escape(first) + "</a> &nbsp;&middot;&nbsp; <a href=\"" + escape(secondHref)
                + "\" style=\"color:#f2f2f2;\">" + escape(second) + "</a></p>";
    }

    static String escape(String text) {
        return HtmlUtils.htmlEscape(text);
    }
}
