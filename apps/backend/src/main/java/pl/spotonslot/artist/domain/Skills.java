package pl.spotonslot.artist.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Self-assessed meters from the profile mockup, each 1–10 or unset. */
@Embeddable
public record Skills(
        @Column(name = "skill_tempo") Integer tempo,
        @Column(name = "skill_experience") Integer experience,
        @Column(name = "skill_energy") Integer energy,
        @Column(name = "skill_vinyl") Integer vinyl,
        @Column(name = "skill_cdj") Integer cdj,
        @Column(name = "skill_production") Integer production) {

    public static final Skills NONE = new Skills(null, null, null, null, null, null);
}
