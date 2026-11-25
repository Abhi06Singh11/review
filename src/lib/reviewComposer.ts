interface RatingComponents {
  openings: readonly string[];
  middles: readonly string[];
  closings: readonly string[];
}

const RATING_COMPONENTS: Record<number, RatingComponents> = {
  1: {
    openings: [
      'Honestly, my visit to {business} was really disappointing.',
      'I rarely leave low ratings, but my experience at {business} was very poor.',
      'Unfortunately, things did not go well at {business} at all.',
      'I came away from {business} pretty frustrated with how things were handled.',
      'To be candid, my time at {business} fell far short of basic expectations.',
    ],
    middles: [
      'Everything felt disorganized from start to finish, and it was hard to get clear help when needed.',
      'The service was noticeably slow and inattentive, and the overall quality left a lot to be desired.',
      'Communication was lacking throughout, and basic standards felt overlooked during my visit.',
      'Wait times dragged on without updates, and the whole experience felt rushed and careless.',
      'Nothing seemed to run smoothly, and I did not feel like my concerns were taken seriously.',
    ],
    closings: [
      'I would not recommend going here unless some major changes are made.',
      'There is a lot that needs fixing before I would consider coming back.',
      'Hopefully management takes a closer look at what went wrong and turns things around.',
      'I expected much better, and it is hard to see myself returning anytime soon.',
    ],
  },
  2: {
    openings: [
      'My experience at {business} was below what I had hoped for.',
      'I left {business} feeling fairly dissatisfied overall.',
      'While I wanted to like {business}, the visit came up short in a few key ways.',
      'Things at {business} were a bit of a letdown this time around.',
      'Unfortunately, {business} did not quite meet expectations during my visit.',
    ],
    middles: [
      'A couple of moments were okay, though the service felt inconsistent and took longer than it should have.',
      'Communication could have been much clearer, and several small details seemed to slip through the cracks.',
      'The pace felt sluggish and disorganized, which made the overall visit more frustrating than it needed to be.',
      'The quality was underwhelming for what I expected, and follow-through needed more care.',
      'It felt like the team was stretched thin, leading to avoidable delays and missed details.',
    ],
    closings: [
      'With better attention to service and consistency, it could improve quite a bit.',
      'There is definite room for improvement before I would feel confident recommending it.',
      'Hopefully they tighten up those areas so future visits go more smoothly.',
      'A few practical improvements would make a noticeable difference here.',
    ],
  },
  3: {
    openings: [
      'My visit to {business} was pretty average overall.',
      'I had a mixed experience at {business}—some good parts and a few drawbacks.',
      'Things at {business} were okay, landing right around the middle for me.',
      '{business} turned out to be a decent but fairly uneven experience.',
      'Overall, {business} was fine, though not quite as smooth as I hoped.',
    ],
    middles: [
      'The team was polite and the setup was convenient, even though parts of the service felt slower than necessary.',
      'A few things went well and felt welcoming, while other details came across as a little rushed.',
      'The basics were handled decently enough, though consistency dipped a bit along the way.',
      'I appreciated the friendly attitude, but wait times and small hiccups kept it from feeling great.',
      'Some aspects met expectations nicely, while a couple of rough edges held the experience back.',
    ],
    closings: [
      'Not bad overall, just a few areas that could use a bit more polish.',
      'It works fine in a pinch, though a little extra consistency would go a long way.',
      'With a few small tweaks, it could easily become a four- or five-star spot.',
      'Good enough for an ordinary visit, with clear room to step things up.',
    ],
  },
  4: {
    openings: [
      'I had a really good experience at {business}.',
      'Overall, my visit to {business} went very well.',
      'I came away from {business} quite pleased with how everything went.',
      'Had a solid, pleasant experience with {business} recently.',
      'I really appreciated the service during my visit to {business}.',
    ],
    middles: [
      'The people were friendly and helpful, and things moved along nicely from start to finish.',
      'Everything felt well-kept and dependable, with clear communication the whole way through.',
      'Quality was strong and the atmosphere was welcoming, making the visit easy and comfortable.',
      'The team took good care of things and kept the whole process straightforward.',
      'I felt well looked after, and the overall standard was noticeably good.',
    ],
    closings: [
      'Just a tiny bit faster turnaround during busy times would make it a full five stars.',
      'Only a couple of small details could be smoother, and I would gladly come back.',
      'A tiny bit more polish is all that is missing—still a great experience I would recommend.',
      'Minor room for improvement here and there, though I left very satisfied overall.',
    ],
  },
  5: {
    openings: [
      'I had an awesome experience at {business} from start to finish.',
      'Honestly, {business} did an incredible job during my visit.',
      'Couldn’t be happier with how things went at {business}.',
      'Five stars for {business}—everything about my visit stood out in the best way.',
      'I had a genuinely wonderful experience with {business}.',
    ],
    middles: [
      'Everyone was warm, attentive, and easy to work with, and everything felt effortless.',
      'The attention to detail and genuine care really showed, making the whole visit a pleasure.',
      'Everything ran smoothly without any hassle, and the quality was consistently great.',
      'The team went out of their way to make sure everything was taken care of properly.',
      'It is rare to find service this reliable, friendly, and well-organized all around.',
    ],
    closings: [
      'I would happily recommend them to anyone and will definitely be coming back.',
      'Easily one of the best experiences I have had—well worth recommending.',
      'Thank you to the team for making it such a smooth visit. Will certainly return.',
      'Highly recommend stopping by if you are looking for great service.',
    ],
  },
};

const lastPickedByRating = new Map<number, string>();

function pickRandomIndex(length: number, seedOffset: number): number {
  return Math.floor((Math.random() * length + seedOffset) % length);
}

export function composeNaturalReview(rating: number, businessName: string): string {
  const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));
  const pool = RATING_COMPONENTS[clampedRating] || RATING_COMPONENTS[5];
  const cleanBusiness = businessName.trim() || 'this business';

  const previous = lastPickedByRating.get(clampedRating);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const oIdx = pickRandomIndex(pool.openings.length, attempt);
    const mIdx = pickRandomIndex(pool.middles.length, attempt * 2);
    const cIdx = pickRandomIndex(pool.closings.length, attempt * 3);

    const text = `${pool.openings[oIdx]} ${pool.middles[mIdx]} ${pool.closings[cIdx]}`.replaceAll(
      '{business}',
      cleanBusiness
    );

    if (text !== previous) {
      lastPickedByRating.set(clampedRating, text);
      return text;
    }
  }

  const fallback = `${pool.openings[0]} ${pool.middles[0]} ${pool.closings[0]}`.replaceAll(
    '{business}',
    cleanBusiness
  );
  lastPickedByRating.set(clampedRating, fallback);
  return fallback;
}
