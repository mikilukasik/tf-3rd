export const getGroups = (totalSize = 22) => {
  const size = totalSize / 22;

  return [
    {
      take: Math.round(size * 2),
      filter: [
        '-0.656',
        '-0.672',
        '-0.688',
        '-0.703',
        '-0.719',
        '-0.734',
        '-0.75',
        '-0.766',
        '-0.781',
        '-0.797',
        '-0.813',
        '-0.828',
        '-0.844',
        '-0.859',
        '-0.875',
        '-0.891',
        '-0.906',
        '-0.922',
        '-0.938',
        '-0.953',
        '-0.969',
        '-0.984',
        '-1',
      ],
    },
    {
      take: Math.round(size * 2),
      filter: [
        '0.641',
        '0.656',
        '0.672',
        '0.688',
        '0.703',
        '0.719',
        '0.734',
        '0.75',
        '0.766',
        '0.781',
        '0.797',
        '0.813',
        '0.828',
        '0.844',
        '0.859',
        '0.875',
        '0.891',
        '0.906',
        '0.922',
        '0.938',
        '0.953',
        '0.969',
        '0.984',
      ],
    },
    {
      take: Math.round(size * 3),
      filter: [
        '-0.359',
        '-0.375',
        '-0.391',
        '-0.406',
        '-0.422',
        '-0.438',
        '-0.453',
        '-0.469',
        '-0.484',
        '-0.5',
        '-0.516',
        '-0.531',
        '-0.547',
        '-0.563',
        '-0.578',
        '-0.594',
        '-0.609',
        '-0.625',
        '-0.641',
      ],
    },
    {
      take: Math.round(size * 3),
      filter: [
        '0.344',
        '0.359',
        '0.375',
        '0.391',
        '0.406',
        '0.422',
        '0.438',
        '0.453',
        '0.469',
        '0.484',
        '0.5',
        '0.516',
        '0.531',
        '0.547',
        '0.563',
        '0.578',
        '0.594',
        '0.609',
        '0.625',
      ],
    },
    {
      take: Math.round(size * 2),
      filter: ['-0.203', '-0.219', '-0.234', '-0.25', '-0.266', '-0.281', '-0.297', '-0.313', '-0.328', '-0.344'],
    },
    {
      take: Math.round(size * 2),
      filter: ['0.188', '0.203', '0.219', '0.234', '0.25', '0.266', '0.281', '0.297', '0.313', '0.328'],
    },
    {
      take: Math.round(size),
      filter: ['-0.141', '-0.156', '-0.172', '-0.188'],
    },
    {
      take: Math.round(size),
      filter: ['0.125', '0.141', '0.156', '0.172'],
    },
    {
      take: Math.round(size),
      filter: ['-0.078', '-0.094', '-0.109', '-0.125'],
    },
    {
      take: Math.round(size),
      filter: ['0.063', '0.078', '0.094', '0.109'],
    },
    {
      take: Math.round(size * 2),
      filter: ['-0.016', '-0.031', '-0.047', '-0.063'],
    },
    {
      take: Math.round(size * 2),
      filter: ['0', '0.016', '0.031', '0.047'],
    },
  ].map(({ filter, take }) => ({ filter, take, groupName: `${filter[0]} to ${filter[filter.length - 1]}` }));
};

export const groups = getGroups();